# Plans

## 역할

Claude Code 플랜 문서를 조회한다. Plan 모드에서 생성된 마크다운 문서를 읽기 전용으로 브라우징할 수 있다.

## 데이터 소스

- 경로: `~/.claude/plans/*.md`
- 형식: Markdown (YAML frontmatter 선택)
- 읽기 전용

## 기능

- 플랜 목록 조회 (수정 시각 최신순)
- frontmatter `title`/`description` 파싱 (없으면 파일명 fallback)
- 마크다운 프리뷰 (기존 MarkdownViewer 재사용)
- 경로 탈출(`..`, `/`) 차단

## API

- `GET /api/plans` — 플랜 목록 (`{ plans, total }`)
- `GET /api/plans?name=X` — 개별 플랜 (frontmatter + content + rawContent)

## 관련 파일

- `app/plans/page.tsx`
- `app/api/plans/route.ts`
- `lib/plans-ops.ts`
- `lib/__tests__/plans-ops.test.ts`
