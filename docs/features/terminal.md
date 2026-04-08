# Terminal

## 역할

Harness Hub 윈도우 안에서 셸을 띄워, GUI로 하네스 상태를 보면서 같은 화면에서 명령(특히 `claude` CLI)을 칠 수 있게 한다.

## 기능

- 하단 도킹 패널에 단일 터미널
- `Cmd+\`` (macOS) / `Ctrl+\`` (Windows/Linux) 토글
- **작업 디렉토리는 터미널을 여는 시점의 페이지로 결정되고, 이후 세션 내내 고정**:
  - `/hooks` → `~/.claude/hooks/`
  - `/skills` → `~/.claude/skills/`
  - `/commands` → `~/.claude/commands/`
  - `/agents`, `/plugins`, `/mcp`, `/rules`, `/memory` → 동일 패턴
  - 그 외 → `~/.claude/`
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
| `electron-src/main.ts` | IPC 핸들러 등록, `before-quit`에서 `killAll` |
| `electron-src/preload.ts` | `contextBridge`로 `window.electronTerminal` 노출 |
| `lib/page-cwd.ts` | pathname → cwd 매핑 (순수 함수, 테스트 완비) |
| `stores/terminal-store.ts` | `isOpen` 상태 Zustand 스토어 |
| `components/terminal-dock.tsx` | xterm.js 마운트, IPC 와이어링, ResizeObserver |
| `components/terminal-dock-wrapper.tsx` | `dynamic({ssr: false})`로 lazy 로드 |
| `components/use-terminal-hotkey.tsx` | 글로벌 단축키 리스너 (`capture: true`) |
| `components/layout-shell.tsx` | `Group`으로 dock을 수직 분할 배치 |
| `types/electron-terminal.d.ts` | `window.electronTerminal` ambient 타입 |

## 알려진 제약

- **단일 터미널만 지원** (탭 없음). MVP 범위 결정.
- **웹 dev 모드**(`pnpm dev`)에서는 `window.electronTerminal`이 없어 안내 문구만 표시. 터미널은 Electron 모드에서만 동작.
- **node-pty는 네이티브 모듈**이라 첫 설치 시 `electron-builder install-app-deps`가 자동으로 Electron ABI에 맞춰 재컴파일. CI에서 이 단계 실패 시 빌드가 빨갛게 될 수 있음.
- **에이전트 자동 호출/컨텍스트 주입 같은 "GUI가 에이전트에게 명령" 기능은 명시적으로 범위 외**. 동시 writer가 GUI 편집기의 미저장 작업을 파괴할 위험이 있어 의도적으로 단순 셸 터미널로 한정.
- **cwd는 열 때 고정**. 다른 페이지의 cwd로 옮기려면 터미널을 닫았다가 그 페이지에서 다시 연다.
