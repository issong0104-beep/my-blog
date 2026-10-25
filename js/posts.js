// 글 목록과 본문을 불러오고 front matter를 읽는다.

const SLUG_RE = /^[a-z0-9-]+$/;
let listPromise = null;

export function parseFrontMatter(raw) {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: text };

  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const value = kv[2].trim();
    meta[kv[1]] = /^\[.*\]$/.test(value)
      ? value
          .slice(1, -1)
          .split(',')
          .map((v) => unquote(v.trim()))
          .filter(Boolean)
      : unquote(value);
  }
  return { meta, body: text.slice(m[0].length) };
}

function unquote(value) {
  return value.replace(/^(['"])(.*)\1$/, '$2');
}

// 한글은 분당 500자, 영문은 분당 200단어로 계산한다. 코드 블록은 뺀다.
export function readingTime(body) {
  const text = body.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
  const hangul = (text.match(/[가-힣]/g) || []).length;
  const words = (text.replace(/[가-힣]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
  return Math.max(1, Math.round(hangul / 500 + words / 200));
}

export function formatDate(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : date || '';
}

async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} 불러오기 실패 (${res.status})`);
  return res;
}

async function loadPost(file) {
  const slug = String(file).replace(/\.md$/, '');
  if (!SLUG_RE.test(slug)) return null;
  try {
    const raw = await (await fetchOk(`posts/${slug}.md`)).text();
    const { meta, body } = parseFrontMatter(raw);
    const tags = Array.isArray(meta.tags) ? meta.tags : meta.tags ? [meta.tags] : [];
    return {
      slug,
      title: meta.title || slug,
      date: meta.date || '',
      description: meta.description || '',
      tags,
      minutes: readingTime(body),
      body,
    };
  } catch (err) {
    console.warn(err);
    return null;
  }
}

// 날짜 최신순으로 정렬된 글 목록. 한 번만 불러와 재사용한다.
export function getPostList() {
  listPromise ??= (async () => {
    const files = await (await fetchOk('posts/index.json')).json();
    const posts = await Promise.all(files.map(loadPost));
    return posts.filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
  })();
  return listPromise;
}

// 글 하나와 앞뒤 글. 없으면 null.
export async function getPost(slug) {
  if (!SLUG_RE.test(slug || '')) return null;
  const list = await getPostList();
  const index = list.findIndex((p) => p.slug === slug);
  if (index < 0) return null;
  return {
    ...list[index],
    newer: list[index - 1] || null,
    older: list[index + 1] || null,
  };
}
