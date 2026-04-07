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
- **4가지 스코프 지원**: User / Project / Local / Organization
  - User: `<claudeHome>/CLAUDE.md` (기본 편집 가능)
  - Project: `<projectRoot>/CLAUDE.md` — 사용자가 UI에서 프로젝트 루트를 명시해야 활성화됨 (안전장치: `dirname(claudeHome)`로 유추하지 않음)
  - Local: `<projectRoot>/CLAUDE.local.md` (gitignore 대상) — 동일하게 projectRoot 필요
  - Organization: OS별 시스템 경로, **읽기 전용**
    - macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`
    - Linux: `/etc/claude-code/CLAUDE.md`
    - Windows: `C:\ProgramData\ClaudeCode\CLAUDE.md`
- 각 스코프 탭에 파일 존재 여부(녹색/회색 점), 읽기 전용(`RO`), 비활성 상태 표시
- Project/Local 스코프는 projectRoot 미입력 시 탭이 비활성화되고 `unavailableReason` 툴팁으로 이유 표시

## 데이터 소스

| 파일 | 용도 |
|------|------|
| `settings.json` | 글로벌 설정 (env, permissions, plugins, hooks 등) |
| `CLAUDE.md` (4 스코프) | 사용자/프로젝트/로컬/조직 지침 |

## API

- `GET /api/settings` — settings.json 내용
- `PUT /api/settings` (type: "settings") — settings.json 수정
- `GET /api/claude-md` — 4개 스코프 메타(경로/존재 여부/writable) 목록
- `GET /api/claude-md?scope={id}` — 특정 스코프 내용
- `PUT /api/claude-md` — 스코프 본문 저장 (org는 거부)

## 관련 파일

- `app/settings/page.tsx`
- `app/api/settings/route.ts`
- `app/api/claude-md/route.ts`
- `lib/claude-md-scopes.ts` — 4 스코프 경로 해석 및 읽기/쓰기
- `lib/__tests__/claude-md-scopes.test.ts`
- `components/json-form.tsx` — JSON 편집 폼 컴포넌트
