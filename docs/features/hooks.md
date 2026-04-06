# Hooks

## 역할

Claude Code의 라이프사이클 훅을 조회하고 삭제한다. 훅은 특정 이벤트 발생 시 자동으로 실행되는 셸 커맨드.

## 기능

- 이벤트 타입별 그룹 표시 (PreToolUse, PostToolUse, PermissionRequest 등)
- 각 훅의 matcher, command, timeout 표시
- 개별 훅 삭제

## 데이터 소스

- `settings.json → hooks` 섹션

## API

- `GET /api/hooks` — 훅 목록 + mtime
- `PUT /api/hooks` — 훅 수정 (settings.json 내부)

## 관련 파일

- `app/hooks/page.tsx`
- `app/api/hooks/route.ts`
