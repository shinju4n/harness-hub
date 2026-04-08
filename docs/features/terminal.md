# Terminal

## 역할

Harness Hub 윈도우 안에서 셸을 띄워, GUI로 하네스 상태를 보면서 같은 화면에서 명령(특히 `claude` CLI)을 칠 수 있게 한다.

## 기능

- 하단 도킹 패널에 단일 터미널
- **`Ctrl+\`` 로 토글** (전 플랫폼 공통, 기본값)
  - macOS에서 `Cmd+\``는 OS가 "같은 앱의 창 순환" 단축키로 예약해뒀기 때문에 Electron 웹뷰까지 키 이벤트가 오지 않음. 그래서 mac에서도 기본값은 `Ctrl+\``.
  - **App Settings → Terminal Hotkey에서 임의의 키 조합으로 재바인딩** 가능. "Press a key…" 버튼을 클릭하고 원하는 조합을 누르면 즉시 저장된다 (앱 재시작 불필요).
  - 단축키 자체를 비활성화하면 도크 툴바 버튼으로만 토글한다.
  - macOS 예약 조합(`Cmd+\``, `Cmd+Q`, `Cmd+W`, `Cmd+H`, `Cmd+M`)을 선택하면 경고가 표시된다 — 저장은 되지만 mac에서는 OS가 키를 가로채 동작하지 않음.
  - 핫키는 `KeyboardEvent.code` 기반으로 매칭되어 **키보드 레이아웃 독립적**(QWERTZ/AZERTY/Dvorak 동일 동작). v0.8.0 이전에 저장된 핫키는 `code` 필드가 비어 있어 layout-dependent 매칭으로 폴백되며, App Settings에서 한 번 재기록하면 layout-independent로 자동 업그레이드된다.
- **작업 디렉토리는 터미널을 여는 시점의 페이지 + 활성 프로필로 결정되고, 이후 세션 내내 고정**:
  - Claude 루트 = 활성 프로필의 `homePath` (기본은 `~/.claude`, 커스텀 프로필이면 그 절대경로)
  - `/hooks` → `<claudeHome>/hooks/`
  - `/skills` → `<claudeHome>/skills/`
  - `/commands` → `<claudeHome>/commands/`
  - `/agents`, `/plugins`, `/mcp`, `/rules`, `/memory` → 동일 패턴
  - 그 외 → `<claudeHome>/`
- 프로필이 다르면 같은 페이지라도 다른 디렉토리에서 터미널이 열린다 (프로필 A는 `/Users/me/.claude/hooks`, 프로필 B는 `/Users/me/work/.claude/hooks` 식)
- cwd 해석은 **메인 프로세스에서** 수행된다 (`electron-src/cwd-resolver.ts`). 렌더러는 `pathname`과 `claudeHome`만 IPC로 전달하고, 메인이 `os.homedir()` 등 Node API로 실제 경로 계산
- 터미널을 연 뒤 사이드바에서 다른 페이지로 이동해도 **PTY는 그대로 살아있고 작업 디렉토리도 변하지 않는다**. 다른 디렉토리의 터미널을 원하면 닫고 다시 연다
- 패널 크기 조절은 수직 리사이즈 핸들로
- 사용자가 GUI 편집기와 같은 파일을 터미널에서 동시에 만지는 경우, 기존 `lib/file-ops.ts`의 mtime 가드가 그대로 보호한다 (Harness Hub가 새로 만든 동시 writer가 아니라, 사용자가 직접 친 명령이므로)

## 데이터 소스

- `node-pty`로 호스트 머신의 셸 spawn
- 환경 변수는 Electron 메인 프로세스의 `process.env`를 그대로 상속

## 플랫폼별 동작

셸 선택 우선순위는 모든 플랫폼에서 다음과 같다:

1. **`HARNESS_HUB_SHELL` 환경변수** (있으면 그대로 사용)
2. 플랫폼 기본값:
   - **macOS/Linux**: `$SHELL` 환경변수 → 없으면 `/bin/zsh`
   - **Windows**: `powershell.exe` (PS 5.1, 모든 Windows에 기본 탑재)
     - `COMSPEC`은 읽지 않는다 — Windows에서 COMSPEC은 거의 항상 `cmd.exe`인데, cmd.exe를 기본으로 주는 건 PowerShell보다 안 좋은 UX라서 의도적으로 배제
     - `pwsh.exe` (PowerShell 7) 또는 `cmd.exe`를 쓰고 싶으면 `HARNESS_HUB_SHELL=pwsh.exe` 같이 override
   - Git Bash for Windows가 `SHELL=/usr/bin/bash`를 설정해뒀어도, 플랫폼 분기가 먼저 걸려 native Windows 셸이 선택됨

**ConPTY 및 Windows 요구사항**:
- node-pty가 Windows 10 1809+에서 ConPTY를 자동 선택. 그 미만 Windows에서는 winpty로 fallback 시도, 그것도 실패하면 터미널 spawn 자체가 실패한다 (알려진 제약)

## 관련 파일

| 파일 | 역할 |
|---|---|
| `electron-src/terminal-manager.ts` | PTY 세션 lifecycle 관리 (의존성 주입 가능한 PtyFactory) |
| `electron-src/cwd-resolver.ts` | `claudeHome` + `pathname` → 절대 cwd 해석 (메인 프로세스 전용, 테스트 완비) |
| `electron-src/main.ts` | IPC 핸들러 등록, `before-quit`에서 `killAll` |
| `electron-src/preload.ts` | `contextBridge`로 `window.electronTerminal` 노출 |
| `stores/terminal-store.ts` | `isOpen` 상태 Zustand 스토어 |
| `components/terminal-dock.tsx` | xterm.js 마운트, IPC 와이어링, ResizeObserver |
| `components/terminal-dock-wrapper.tsx` | `dynamic({ssr: false})`로 lazy 로드 |
| `components/use-terminal-hotkey.tsx` | 글로벌 단축키 리스너 (`capture: true`) |
| `components/layout-shell.tsx` | `Group`으로 dock을 수직 분할 배치 |
| `types/electron-terminal.d.ts` | `window.electronTerminal` ambient 타입 |

## 구현 노트 — Strict Mode 방어

`components/terminal-dock.tsx`의 `useEffect`는 빈 의존성(`[]`)에 `eslint-disable-next-line react-hooks/exhaustive-deps` 가 붙어 있고, **의도한 동작**이다. 이유:

- React 19 + Next.js 16 개발 모드는 Strict Mode에서 effect를 두 번 실행한다 (setup → cleanup → setup 재실행)
- 이 때문에 effect가 실행될 때마다 `api.create()`로 PTY가 두 번 요청될 수 있다
- 첫 번째 PTY는 cleanup에서 `api.kill()`로 종료되지만, 그 kill의 exit 이벤트는 **두 번째 effect의 `onExit` 리스너에 도착**한다 (비동기)
- 따라서 `onData`/`onExit` 리스너는 **반드시 `id !== activeId` 필터**를 거쳐서 "현재 이 effect가 소유한 PTY"의 이벤트만 처리한다
- 이 id 필터가 없으면 전 effect의 kill이 현재 effect의 `activeId`를 null로 덮어써서 키 입력이 차단된다 (실제로 개발 중 발생했던 버그)

Pathname이 바뀔 때 PTY를 재생성하지 않는 것도 같은 effect 설계의 일부 — 셸은 "열 때" 한 번 만들어지고 세션 내내 고정.

## 알려진 제약

- **단일 터미널만 지원** (탭 없음). MVP 범위 결정.
- **웹 dev 모드**(`pnpm dev`)에서는 `window.electronTerminal`이 없어 안내 문구만 표시. 터미널은 Electron 모드에서만 동작.
- **node-pty는 네이티브 모듈**이라 첫 설치 시 `electron-builder install-app-deps`가 자동으로 Electron ABI에 맞춰 재컴파일. CI에서 이 단계 실패 시 빌드가 빨갛게 될 수 있음.
- **에이전트 자동 호출/컨텍스트 주입 같은 "GUI가 에이전트에게 명령" 기능은 명시적으로 범위 외**. 동시 writer가 GUI 편집기의 미저장 작업을 파괴할 위험이 있어 의도적으로 단순 셸 터미널로 한정.
- **cwd는 열 때 고정**. 다른 페이지의 cwd로 옮기려면 터미널을 닫았다가 그 페이지에서 다시 연다.
