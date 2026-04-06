# Commands

## 역할

사용자가 만든 커스텀 슬래시 커맨드 (`/command-name`)를 조회하고 편집한다.

## 기능

- `~/.claude/commands/*.md` 파일 목록 표시
- 마크다운 렌더링 (Preview / Raw / Edit)
- 인라인 편집 후 저장

## 데이터 소스

- `commands/*.md` — 커맨드 정의 파일 (마크다운)

## API

- `GET /api/commands` — 커맨드 목록
- `GET /api/commands?name=X` — 특정 커맨드 내용
- `PUT /api/commands` — 커맨드 수정

## 관련 파일

- `app/commands/page.tsx`
- `app/api/commands/route.ts`
