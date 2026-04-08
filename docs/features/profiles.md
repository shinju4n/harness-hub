# Profiles

## 역할

여러 개의 Claude 홈 디렉토리(`~/.claude` 또는 임의 경로의 `.claude`)를 프로필로 등록하고 한 클릭으로 전환한다. 회사/개인, 클라이언트별, 외장 드라이브 등 멀티 컨텍스트 사용자를 위한 기능.

## 기능

- 프로필 추가/이름 변경/삭제 (App Settings 페이지의 **Profiles** 섹션)
- 활성 프로필 전환 — 전환 즉시 모든 페이지가 해당 `homePath`를 데이터 소스로 사용
- 기본 프로필(`Default`)은 `~/.claude` 자동 탐지(`auto`)이며 삭제할 수 없음
- 프로필 정보는 zustand persist를 통해 `localStorage`에 저장됨

## homePath 규칙

`homePath`는 다음 둘 중 하나여야 한다:

- `auto` — 운영체제별 기본 위치(`$HOME/.claude` 또는 `%USERPROFILE%\.claude`)를 자동 탐지
- **임의의 절대경로** — 예: `/Users/me/.claude`, `/Volumes/Work/.claude`, `/mnt/data/.claude`, `D:\projects\.claude`

다음 경로 형태도 모두 허용된다:

- 외장 드라이브 / 마운트 볼륨 (`/Volumes/...`, `/mnt/...`, `D:\...`)
- NAS, Dropbox, iCloud Drive 등 클라우드 동기화 폴더
- `$HOME` 바깥의 임의 디렉토리

위생 검사만 통과하면 된다(절대경로일 것, NUL 바이트 없을 것, 비어있지 않을 것). 0.8.0 이전 버전에 있던 `$HOME` / `tmpdir` / `HARNESS_HUB_ALLOWED_HOMES` 화이트리스트 제한은 제거됐다 — Harness Hub는 단일 사용자 데스크톱 앱(`127.0.0.1` 바인드 + Electron `contextIsolation`)이라 그 화이트리스트가 실제로 막아주는 위협이 거의 없었기 때문.

## 데이터 소스

| 위치 | 용도 |
|------|------|
| `localStorage` (`harness-hub-settings`) | 프로필 목록, 활성 프로필 ID |
| `<homePath>/...` | 모든 페이지가 활성 프로필의 경로를 통해 읽기 |

## 관련 파일

- `stores/app-settings-store.ts` — `Profile` 인터페이스, persist 스토어
- `app/app-settings/page.tsx` — Profiles 섹션 UI
- `lib/claude-home.ts` — `getClaudeHome` / `resolveAndValidate` (위생 검사만)
- `lib/__tests__/claude-home.test.ts` — 검증 테스트
