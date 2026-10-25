// 다크 모드 토글. 첫 테마는 <head>의 인라인 스크립트가 정한다.

const SUN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
const MOON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

function savedTheme() {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function initThemeToggle(button) {
  if (!button) return;

  const render = () => {
    const dark = currentTheme() === 'dark';
    button.innerHTML = dark ? SUN : MOON;
    button.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
  };

  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // 저장할 수 없어도 이번 페이지에서는 바뀐 테마가 유지된다
    }
    render();
  });

  // 직접 고른 적이 없으면 시스템 설정 변경을 따라간다
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (savedTheme()) return;
    document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
    render();
  });

  render();
}
