# Settings

## 역할

Claude Code의 글로벌 설정 파일(`settings.json`)을 폼 UI로 조회·편집한다.

> CLAUDE.md 편집은 별도의 [CLAUDE.md 페이지](claude-md.md)로 분리되었다 (v0.8.2부터).

## 기능

- 키별 폼 UI로 설정 조회/편집
- object 값: JSON textarea 편집
- 필드 추가/삭제
- `hooks` 키는 읽기 전용 — Hooks 페이지로 안내 링크 표시
- CLAUDE.md 페이지로 가는 안내 링크 표시
- mtime 충돌 감지 + 자동 백업

## 데이터 소스

| 파일 | 용도 |
|------|------|
| `<claudeHome>/settings.json` | 글로벌 설정 (env, permissions, plugins, hooks 등) |

## API

- `GET /api/settings` — settings.json 내용
- `PUT /api/settings` (type: "settings") — settings.json 수정

## 관련 파일

- `app/settings/page.tsx`
- `app/api/settings/route.ts`
- `components/json-form.tsx` — JSON 편집 폼 컴포넌트
