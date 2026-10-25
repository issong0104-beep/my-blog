// 페이지별 진입점. <body data-page="list|post">로 구분한다.

import { getPostList, getPost, formatDate } from './posts.js';
import { parseMarkdown } from './markdown.js';
import { initThemeToggle } from './theme.js';

const SITE_NAME = 'My Blog';

initThemeToggle(document.querySelector('.theme-toggle'));

const app = document.getElementById('app');
if (document.body.dataset.page === 'list') renderList();
if (document.body.dataset.page === 'post') renderPost();

// 텍스트는 항상 textContent로 넣어 HTML로 해석되지 않게 한다
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false && c !== ''));
  return node;
}

const postUrl = (slug) => `post.html?slug=${encodeURIComponent(slug)}`;
const tagUrl = (tag) => `index.html?tag=${encodeURIComponent(tag)}`;

function postMeta(post) {
  return el(
    'p',
    { class: 'post-meta' },
    post.date && el('time', { datetime: post.date }, formatDate(post.date)),
    post.date && el('span', { 'aria-hidden': 'true' }, '·'),
    el('span', {}, `${post.minutes}분 읽기`)
  );
}

function tagList(tags) {
  if (!tags.length) return null;
  return el(
    'ul',
    { class: 'tag-list', 'aria-label': '태그' },
    ...tags.map((tag) => el('li', {}, el('a', { class: 'tag', href: tagUrl(tag) }, `#${tag}`)))
  );
}

function showMessage(title, description) {
  app.replaceChildren(
    el(
      'div',
      { class: 'message' },
      el('h1', {}, title),
      description && el('p', {}, description),
      el('a', { href: 'index.html' }, '← 글 목록으로')
    )
  );
}

// ---------- 목록 페이지 ----------

async function renderList() {
  let posts;
  try {
    posts = await getPostList();
  } catch {
    showMessage('글 목록을 불러오지 못했습니다', '로컬 서버로 열었는지 확인해 주세요.');
    return;
  }
  if (!posts.length) {
    showMessage('아직 글이 없습니다');
    return;
  }

  const tags = [...new Set(posts.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b, 'ko'));
  let active = new URLSearchParams(location.search).get('tag');
  if (!tags.includes(active)) active = null;

  const list = el('ul', { class: 'post-list' });
  const chips = [null, ...tags].map((tag) => {
    const chip = el('button', { type: 'button', class: 'tag-chip' }, tag ? `#${tag}` : '전체');
    chip.dataset.tag = tag ?? '';
    chip.addEventListener('click', () => {
      active = tag;
      const url = new URL(location.href);
      if (tag) url.searchParams.set('tag', tag);
      else url.searchParams.delete('tag');
      history.replaceState(null, '', url);
      update();
    });
    return chip;
  });

  function update() {
    for (const chip of chips) {
      chip.setAttribute('aria-pressed', String(chip.dataset.tag === (active ?? '')));
    }
    const shown = active ? posts.filter((p) => p.tags.includes(active)) : posts;
    list.replaceChildren(...shown.map(postCard));
  }

  app.replaceChildren(el('nav', { class: 'tag-bar', 'aria-label': '태그로 거르기' }, ...chips), list);
  update();
}

function postCard(post) {
  return el(
    'li',
    { class: 'post-card' },
    el('h2', { class: 'post-card-title' }, el('a', { href: postUrl(post.slug) }, post.title)),
    postMeta(post),
    post.description && el('p', { class: 'post-card-desc' }, post.description),
    tagList(post.tags)
  );
}

// ---------- 글 상세 페이지 ----------

async function renderPost() {
  const slug = new URLSearchParams(location.search).get('slug');
  let post;
  try {
    post = await getPost(slug);
  } catch {
    showMessage('글을 불러오지 못했습니다', '로컬 서버로 열었는지 확인해 주세요.');
    return;
  }
  if (!post) {
    document.title = `글을 찾을 수 없습니다 · ${SITE_NAME}`;
    showMessage('글을 찾을 수 없습니다', '주소를 다시 확인하거나 글 목록으로 돌아가 주세요.');
    return;
  }

  document.title = `${post.title} · ${SITE_NAME}`;
  const { html, headings } = parseMarkdown(post.body);

  const prose = el('div', { class: 'prose' });
  prose.innerHTML = html; // parseMarkdown이 원문 HTML을 이스케이프한다

  const article = el(
    'article',
    { class: 'post' },
    el('header', { class: 'post-header' }, el('h1', { class: 'post-title' }, post.title), postMeta(post), tagList(post.tags)),
    buildToc(headings),
    prose
  );
  app.replaceChildren(article, postNav(post));

  // 본문이 늦게 그려지므로 주소의 #제목으로 직접 이동한다
  if (location.hash) {
    document
      .getElementById(decodeURIComponent(location.hash.slice(1)))
      ?.scrollIntoView({ behavior: 'instant' });
  }
}

function buildToc(headings) {
  const items = headings.filter((h) => h.level === 2 || h.level === 3);
  if (items.length < 2) return null;

  const details = el(
    'details',
    {},
    el('summary', {}, '목차'),
    el(
      'nav',
      { 'aria-label': '목차' },
      el(
        'ol',
        {},
        ...items.map((h) => el('li', { class: `toc-h${h.level}` }, el('a', { href: `#${h.id}` }, h.text)))
      )
    )
  );

  // 넓은 화면에서는 옆에 펼쳐 두고, 좁은 화면에서는 접어 둔다
  const wide = matchMedia('(min-width: 1200px)');
  const sync = () => {
    details.open = wide.matches;
  };
  sync();
  wide.addEventListener('change', sync);

  return el('aside', { class: 'toc' }, details);
}

function postNav(post) {
  if (!post.older && !post.newer) return null;
  const link = (target, label, cls) =>
    target
      ? el(
          'a',
          { class: `post-nav-link ${cls}`, href: postUrl(target.slug) },
          el('span', { class: 'post-nav-label' }, label),
          el('span', { class: 'post-nav-title' }, target.title)
        )
      : el('span', { class: 'post-nav-spacer', 'aria-hidden': 'true' });

  return el(
    'nav',
    { class: 'post-nav', 'aria-label': '이전 글과 다음 글' },
    link(post.older, '← 이전 글', 'prev'),
    link(post.newer, '다음 글 →', 'next')
  );
}
