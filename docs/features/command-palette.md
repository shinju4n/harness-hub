# Command Palette (Cmd+K)

## 역할

VS Code / Linear 스타일의 전역 커맨드 팔레트. `Cmd+K` (mac) / `Ctrl+K` (win/linux) 로 열어 페이지·에이전트·플랜·훅 스크립트·세션을 한 번에 검색하고 즉시 점프한다.

## 기능

- 전역 키 바인딩: `Cmd+K` / `Ctrl+K` 토글, `Escape` 닫기, 바깥 클릭 닫기
- 150ms 디바운스 검색, 카테고리별 그룹 렌더링
- Up/Down 화살표 + Enter 로 키보드 네비게이션
- 카테고리:
  - **Pages** — 모든 사이드바 페이지 (정적 인덱스)
  - **Agents** — `~/.claude/agents/*.md` 의 name/description
  - **Plans** — `~/.claude/plans/*.md` 의 title/description
  - **Hook Scripts** — `~/.claude/hooks/` 파일명 + 언어
  - **Sessions** — 최근 50개 sessionId + cwd
- 카테고리당 최대 8개, 총 30개 결과 제한

## 데이터 소스

서버 라우트 `/api/search?q=...` 가 요청 시 `lib/` 헬퍼(`readMarkdownFile`, `readPlans`, `listHookFiles`, `readSessions`) 를 통해 인덱스를 빌드한다.

## API

- `GET /api/search?q=<string>` → `SearchResult[]`
  ```ts
  type SearchResult = {
    category: "Pages" | "Agents" | "Plans" | "Hook Scripts" | "Sessions" | "History";
    title: string;
    subtitle?: string;
    href: string;
  };
  ```

## 관련 파일

- `app/api/search/route.ts` — 검색 라우트
- `components/command-palette.tsx` — 팔레트 UI + 키 바인딩
- `app/layout.tsx` — `<CommandPalette />` 전역 마운트
