// 마크다운 → HTML 변환기
// 원문의 HTML은 모두 이스케이프하므로 결과를 innerHTML에 넣어도 안전하다.

const LIST_RE = /^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*([\w+#.-]*)/;
const HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE_RE = /^ {0,3}> ?/;
// 주소 안의 괄호는 한 단계까지 허용한다: (javascript:alert(1))
const URL_PART = String.raw`((?:[^()\s]|\([^()\s]*\))+)`;
const TITLE_PART = String.raw`(?:\s+&quot;(.*?)&quot;)?`;
const IMAGE_RE = new RegExp(String.raw`!\[([^\]]*)\]\(` + URL_PART + TITLE_PART + String.raw`\)`, 'g');
const LINK_RE = new RegExp(String.raw`\[([^\]]+)\]\(` + URL_PART + TITLE_PART + String.raw`\)`, 'g');
const TABLE_SEP_RE = /^ *\|? *:?-+:? *(?:\| *:?-+:? *)*\|? *$/;

export function parseMarkdown(src) {
  const ctx = createContext();
  const lines = String(src)
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^\t+/, (tabs) => '    '.repeat(tabs.length)));
  return { html: parseBlocks(lines, ctx), headings: ctx.headings };
}

export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createContext() {
  const counts = new Map();
  return {
    headings: [],
    slugify(text) {
      const base =
        text
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s-]/gu, '')
          .trim()
          .replace(/\s+/g, '-') || 'section';
      const n = (counts.get(base) || 0) + 1;
      counts.set(base, n);
      return n === 1 ? base : `${base}-${n}`;
    },
  };
}

// ---------- 블록 ----------

function parseBlocks(lines, ctx) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    let m;

    if ((m = line.match(FENCE_RE))) {
      const fence = m[1];
      const lang = m[2];
      const close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`);
      const code = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) code.push(lines[i++]);
      i++;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if ((m = line.match(HEADING_RE))) {
      const level = m[1].length;
      const text = plainText(m[2]);
      const id = ctx.slugify(text);
      ctx.headings.push({ level, text, id });
      out.push(`<h${level} id="${id}">${inline(m[2])}</h${level}>`);
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const inner = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        inner.push(lines[i++].replace(QUOTE_RE, ''));
      }
      out.push(`<blockquote>\n${parseBlocks(inner, ctx)}\n</blockquote>`);
      continue;
    }

    if (LIST_RE.test(line)) {
      const list = parseList(lines, i, ctx);
      out.push(list.html);
      i = list.next;
      continue;
    }

    if (isTableStart(lines, i)) {
      const table = parseTable(lines, i);
      out.push(table.html);
      i = table.next;
      continue;
    }

    const para = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isBlockStart(lines[i]) &&
      !isTableStart(lines, i)
    ) {
      para.push(lines[i++]);
    }
    out.push(`<p>${inline(para.join('\n').trim())}</p>`);
  }

  return out.join('\n');
}

function isBlockStart(line) {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line)
  );
}

function isTableStart(lines, i) {
  const next = lines[i + 1];
  return (
    lines[i].includes('|') &&
    next !== undefined &&
    next.includes('|') &&
    TABLE_SEP_RE.test(next)
  );
}

function indentOf(line) {
  return line.match(/^ */)[0].length;
}

function nextNonBlank(lines, i) {
  let j = i;
  while (j < lines.length && !lines[j].trim()) j++;
  return j;
}

function parseList(lines, start, ctx) {
  const first = lines[start].match(LIST_RE);
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const isSibling = (m) => m && m[1].length === indent && /\d/.test(m[2]) === ordered;
  const items = [];
  let loose = false;
  let i = start;

  while (i < lines.length) {
    const m = lines[i].match(LIST_RE);
    if (!isSibling(m)) break;

    const contentIndent = indent + m[2].length + 1;
    const body = [m[3]];
    i++;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        // 빈 줄 뒤에 들여쓴 줄이 오면 같은 항목이 이어진다
        const j = nextNonBlank(lines, i);
        if (j < lines.length && indentOf(lines[j]) > indent) {
          for (; i < j; i++) body.push('');
          loose = true;
          continue;
        }
        break;
      }
      if (indentOf(line) > indent || (!LIST_RE.test(line) && !isBlockStart(line))) {
        body.push(line);
        i++;
        continue;
      }
      break;
    }

    const dedent = new RegExp(`^ {0,${contentIndent}}`);
    items.push(parseBlocks(body.map((l, k) => (k === 0 ? l : l.replace(dedent, ''))), ctx));

    // 항목 사이의 빈 줄은 목록을 끝내지 않고 느슨한 목록으로 만든다
    const j = nextNonBlank(lines, i);
    if (j > i && j < lines.length && isSibling(lines[j].match(LIST_RE))) {
      loose = true;
      i = j;
    }
  }

  const tag = ordered ? 'ol' : 'ul';
  const startNum = parseInt(first[2], 10);
  const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
  const lis = items
    .map((html) => `<li>${loose ? html : html.replace(/^<p>([\s\S]*?)<\/p>/, '$1')}</li>`)
    .join('\n');
  return { html: `<${tag}${startAttr}>\n${lis}\n</${tag}>`, next: i };
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function parseTable(lines, start) {
  const head = splitRow(lines[start]);
  const aligns = splitRow(lines[start + 1]).map((c) => {
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.endsWith(':')) return 'right';
    if (c.startsWith(':')) return 'left';
    return '';
  });

  let i = start + 2;
  const rows = [];
  while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
    rows.push(splitRow(lines[i++]));
  }

  const cell = (tag, text, k) => {
    const style = aligns[k] ? ` style="text-align:${aligns[k]}"` : '';
    return `<${tag}${style}>${inline(text)}</${tag}>`;
  };
  const thead = `<tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr>`;
  const tbody = rows
    .map((row) => `<tr>${head.map((_, k) => cell('td', row[k] ?? '', k)).join('')}</tr>`)
    .join('\n');

  return {
    html: `<div class="table-wrap"><table><thead>${thead}</thead>${
      rows.length ? `<tbody>${tbody}</tbody>` : ''
    }</table></div>`,
    next: i,
  };
}

// ---------- 인라인 ----------

function inline(src) {
  // 이미 변환한 조각은 자리표시자로 빼 두어 이후 규칙이 건드리지 않게 한다
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;

  let s = escapeHtml(src);

  s = s.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${code}</code>`));
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!~|])/g, (_, ch) => keep(ch));

  s = s.replace(/&lt;(https?:\/\/[^\s]+?)&gt;/g, (_, url) =>
    keep(`<a href="${safeUrl(url)}" rel="noopener noreferrer">${url}</a>`)
  );

  s = s.replace(
    IMAGE_RE,
    (_, alt, url, title) =>
      keep(
        `<img src="${safeUrl(url)}" alt="${alt}"${
          title ? ` title="${title}"` : ''
        } loading="lazy">`
      )
  );

  s = s.replace(
    LINK_RE,
    (_, label, url, title) => {
      const href = safeUrl(url);
      const rel = /^https?:/i.test(href) ? ' rel="noopener noreferrer"' : '';
      return keep(
        `<a href="${href}"${title ? ` title="${title}"` : ''}${rel}>${emphasis(label)}</a>`
      );
    }
  );

  s = emphasis(s);
  s = s.replace(/(?: {2,}|\\)\n/g, '<br>\n');

  while (/\u0000\d+\u0000/.test(s)) {
    s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => stash[n]);
  }
  return s;
}

function emphasis(s) {
  return s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/\*(?=\S)([\s\S]*?\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=\S)([\s\S]*?\S)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
}

// http(s), mailto, 상대 경로, #만 허용하고 나머지 스킴(javascript: 등)은 막는다
function safeUrl(url) {
  const clean = url.replace(/[\u0001- \u007f]/g, '');
  if (/^(https?:|mailto:)/i.test(clean)) return clean;
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) return '#';
  return clean;
}

function plainText(md) {
  return md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\\(.)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}
