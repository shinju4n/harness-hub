# Rules

## 역할

Claude Code의 조건부 규칙 파일을 조회하고 편집한다. 규칙은 특정 파일 경로나 조건에 따라 적용되는 추가 지침.

## 기능

- `~/.claude/rules/*.md` 파일 목록 표시
- 마크다운 렌더링 (Preview / Raw / Edit)
- 인라인 편집 후 저장

## 데이터 소스

- `rules/*.md` — 조건부 규칙 파일 (마크다운)

## API

- `GET /api/rules` — 규칙 목록
- `GET /api/rules?name=X` — 특정 규칙 내용
- `PUT /api/rules` — 규칙 수정

## 관련 파일

- `app/rules/page.tsx`
- `app/api/rules/route.ts`
