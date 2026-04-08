# CLAUDE.md

## 역할

Claude Code의 사용자 지침 파일(`CLAUDE.md`)을 4개 스코프(User / Project / Local / Organization)에 걸쳐 조회·편집한다. v0.8.2 이전에는 Settings 페이지의 탭으로 들어 있었으나, 별도 페이지로 분리되었다.

## 기능

- 마크다운 렌더링 (Preview / Raw / Edit)
- 인라인 편집 후 저장 — `mtime` 충돌 감지 + 자동 백업
- **4가지 스코프 지원**:
  - **User**: `<claudeHome>/CLAUDE.md` (기본 편집 가능)
  - **Project**: `<projectRoot>/CLAUDE.md` — 사용자가 UI에서 프로젝트 루트를 명시해야 활성화됨 (안전장치: `dirname(claudeHome)`로 유추하지 않음)
  - **Local**: `<projectRoot>/CLAUDE.local.md` (gitignore 대상) — 동일하게 projectRoot 필요
  - **Organization**: OS별 시스템 경로, **읽기 전용**
    - macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`
    - Linux: `/etc/claude-code/CLAUDE.md`
    - Windows: `C:\ProgramData\ClaudeCode\CLAUDE.md`
- 각 스코프 탭에 파일 존재 여부(녹색/회색 점), 읽기 전용(`RO`), 비활성 상태 표시
- Project/Local 스코프는 projectRoot 미입력 시 비활성화되고 `unavailableReason` 툴팁으로 이유 표시
- 프로젝트 루트 입력에는 폴더 브라우저 + 최근 사용 경로 드롭다운(localStorage `harness-hub:recent-project-roots`, 최대 5개)
- **프로필 기반 자동 추론**: 활성 프로필의 `homePath` basename이 정확히 `.claude`이면(예: `/Users/me/repo/.claude`) 부모 디렉터리를 projectRoot 입력에 자동으로 채워, Project/Local 스코프가 즉시 활성화된다. 사용자가 직접 명시한 경로이므로 안전하며, 입력값은 그대로 수정·삭제 가능. 기본 프로필(`auto`)에는 적용되지 않음 — `~/.claude`의 부모는 프로젝트가 아니기 때문

## 진입 방법

- 사이드바 `CLAUDE.md` 메뉴
- Dashboard의 `CLAUDE.md` 카드
- Sessions 페이지에서 세션 cwd를 클릭하면 해당 경로가 projectRoot로 prefill되어 이동
- 쿼리 파라미터: `/claude-md?projectRoot=<absolute-path>`

## 데이터 소스

| 파일 | 용도 |
|------|------|
| `<claudeHome>/CLAUDE.md` | User 스코프 — 글로벌 사용자 지침 |
| `<projectRoot>/CLAUDE.md` | Project 스코프 — 프로젝트 단위 지침 |
| `<projectRoot>/CLAUDE.local.md` | Local 스코프 — 개인 로컬 오버라이드 (gitignore) |
| OS 시스템 경로 | Organization 스코프 — 조직 정책 (RO) |

## API

- `GET /api/claude-md` — 4개 스코프 메타(경로/존재 여부/writable) 목록
- `GET /api/claude-md?scope={id}&projectRoot=<path>` — 특정 스코프 내용
- `PUT /api/claude-md` — 스코프 본문 저장 (`org`는 거부)

## 관련 파일

- `app/claude-md/page.tsx`
- `app/api/claude-md/route.ts`
- `lib/claude-md-scopes.ts` — 4 스코프 경로 해석 및 읽기/쓰기
- `lib/__tests__/claude-md-scopes.test.ts`
- `components/markdown-viewer.tsx`
- `components/folder-picker.tsx`
