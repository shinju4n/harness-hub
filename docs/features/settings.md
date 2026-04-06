# Settings

## 역할

Claude Code의 글로벌 설정 파일(`settings.json`)과 사용자 지침 파일(`CLAUDE.md`)을 조회하고 편집한다.

## 기능

### settings.json 탭
- 키별 폼 UI로 설정 조회/편집
- object 값: JSON textarea 편집
- 필드 추가/삭제
- hooks 키는 읽기 전용 (Hooks 페이지로 링크)
- mtime 충돌 감지 + 자동 백업

### CLAUDE.md 탭
- 마크다운 렌더링 (Preview / Raw / Edit)
- 인라인 편집 후 저장

## 데이터 소스

| 파일 | 용도 |
|------|------|
| `settings.json` | 글로벌 설정 (env, permissions, plugins, hooks 등) |
| `CLAUDE.md` | 글로벌 사용자 지침 |

## API

- `GET /api/settings` — settings.json + CLAUDE.md 내용
- `PUT /api/settings` (type: "settings") — settings.json 수정
- `PUT /api/settings` (type: "claude-md") — CLAUDE.md 수정

## 관련 파일

- `app/settings/page.tsx`
- `app/api/settings/route.ts`
- `components/json-form.tsx` — JSON 편집 폼 컴포넌트
