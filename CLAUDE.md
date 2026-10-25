# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code에게 프로젝트 지침을 제공합니다.

## 프로젝트 개요

마크다운(`.md`) 파일로 작성한 글을 읽어 블로그 웹사이트로 보여주는 정적 사이트입니다.
**프레임워크와 빌드 도구 없이** 순수 HTML, CSS, JavaScript(Vanilla JS)로만 구현합니다.

## 기술 원칙

- **프레임워크·라이브러리 금지**: React, Vue, Tailwind, jQuery, Bootstrap 등을 쓰지 않습니다.
- **빌드 단계 없음**: npm, 번들러, 트랜스파일러 없이 브라우저에서 바로 동작해야 합니다.
- **마크다운 파서 직접 구현**: `js/markdown.js`에 자체 파서를 작성합니다. 외부 CDN 의존성을 두지 않습니다.
- **모던 표준 사용**: ES 모듈(`<script type="module">`), `fetch`, CSS 커스텀 속성, 시맨틱 HTML을 사용합니다.
- 코드는 작고 읽기 쉽게 유지하고, 파일 하나가 한 가지 역할만 맡도록 나눕니다.

## 디렉터리 구조

```
my-blog/
├── index.html          # 글 목록 페이지
├── post.html           # 글 상세 페이지 (?slug=파일명)
├── css/
│   └── style.css       # 전체 스타일 (테마 변수 포함)
├── js/
│   ├── markdown.js     # 마크다운 → HTML 변환기
│   ├── posts.js        # 글 목록/본문 불러오기, front matter 파싱
│   ├── theme.js        # 다크 모드 토글
│   └── main.js         # 페이지별 진입점
├── images/             # 글에 쓰는 이미지 (본문에서 images/파일명 으로 참조)
└── posts/
    ├── index.json      # 글 목록 (파일명 배열)
    └── *.md            # 블로그 글
```

## 기능

- **태그 필터**: 목록 페이지의 태그 칩으로 거르며, 상태는 `?tag=` 쿼리로 유지됩니다.
- **목차(TOC)**: h2·h3가 2개 이상이면 표시합니다. 1200px 미만에서는 본문 위에 접힌 상자로, 이상에서는 본문 오른쪽에 고정됩니다.
- **읽는 시간**: 코드 블록을 빼고 한글 분당 500자, 영문 분당 200단어로 계산합니다.
- **이전/다음 글**: 날짜순으로 앞뒤 글을 글 하단에 링크합니다.

## 글 작성 규칙

각 글은 `posts/` 폴더의 마크다운 파일이며, 맨 위에 YAML 형식의 front matter를 둡니다.

```markdown
---
title: 글 제목
date: 2026-10-18
tags: [javascript, css]
description: 목록에 표시될 한두 줄 요약
---

본문 내용...
```

- 파일명은 영문 소문자와 하이픈으로 작성합니다 (예: `my-first-post.md`). 파일명이 곧 slug입니다.
- 새 글을 추가하면 `posts/index.json`에도 파일명을 추가해야 목록에 나타납니다.
- 목록은 `date` 기준 최신순으로 정렬합니다.

## 마크다운 지원 범위

`js/markdown.js`는 최소한 다음 문법을 지원해야 합니다.

- 제목(`#` ~ `######`), 문단, 줄바꿈
- 굵게, 기울임, 취소선, 인라인 코드
- 링크, 이미지
- 순서 있는/없는 목록 (중첩 포함)
- 인용문, 수평선
- 펜스 코드 블록 (```` ```언어 ````) — `class="language-xxx"` 부여
- 표

**보안**: 변환 전 원문의 HTML 특수문자(`<`, `>`, `&`, `"`)를 이스케이프하고, 링크의 `javascript:` 스킴은 차단합니다.

## 디자인 가이드

### 깔끔하고 읽기 좋게
- 본문 최대 너비 약 `680px`(약 65~75자), 가운데 정렬
- 본문 글자 크기 `17~18px`, 줄간격 `1.7~1.8`
- 한글 가독성을 위해 시스템 폰트 스택 사용:
  `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif`
- `word-break: keep-all`로 한글 단어 단위 줄바꿈
- 장식은 최소화하고, 여백과 타이포그래피 위계로 구조를 표현합니다.
- 강조 색(accent)은 하나만 사용합니다.

### 다크 모드
- 모든 색상은 `:root`의 CSS 커스텀 속성으로 정의합니다 (예: `--bg`, `--text`, `--text-muted`, `--accent`, `--border`, `--code-bg`).
- 기본값은 `prefers-color-scheme`(시스템 설정)을 따릅니다.
- 헤더의 토글 버튼으로 수동 전환하며, 선택은 `localStorage`에 저장하고 `<html data-theme="dark|light">`로 적용합니다.
- 페이지 로드 시 깜빡임(FOUC)을 막기 위해 테마 결정 스크립트는 `<head>` 안에 인라인으로 넣습니다.
- `localStorage` 접근은 `try/catch`로 감쌉니다.
- 두 테마 모두 본문 대비율 WCAG AA(4.5:1) 이상을 지킵니다.

### 반응형 / 모바일
- 모바일 우선(mobile-first)으로 작성하고, 넓은 화면에서 `min-width` 미디어 쿼리로 확장합니다.
- 좌우 여백 최소 `16px`, 가로 스크롤이 생기지 않아야 합니다.
- 코드 블록과 표는 해당 요소 안에서만 가로 스크롤(`overflow-x: auto`)되게 합니다.
- 이미지는 `max-width: 100%; height: auto;`
- 버튼·링크 등 터치 대상은 최소 `44×44px`
- `<meta name="viewport" content="width=device-width, initial-scale=1">` 필수

## 접근성

- 시맨틱 태그 사용: `<header>`, `<nav>`, `<main>`, `<article>`, `<footer>`, `<time>`
- 테마 토글 버튼에 `aria-label` 제공
- 키보드 포커스 표시(`:focus-visible`)를 제거하지 않습니다.
- `prefers-reduced-motion`이 설정되면 전환 애니메이션을 끕니다.

## 로컬 실행

`fetch`로 마크다운 파일을 읽기 때문에 `file://`로 직접 열면 동작하지 않습니다. 로컬 서버를 사용하세요.

```bash
python3 -m http.server 8000
```

이후 http://localhost:8000 에 접속합니다.

## 작업 시 확인 사항

- 변경 후 라이트/다크 모드 양쪽에서 화면을 확인합니다.
- 모바일 너비(375px)와 데스크톱 너비 모두에서 레이아웃을 확인합니다.
- 브라우저 콘솔에 에러가 없어야 합니다.
- 존재하지 않는 slug로 접근하면 "글을 찾을 수 없습니다" 안내를 보여줍니다.
