# Sessions

## 역할

현재/최근 Claude Code 세션 정보를 조회한다. 각 세션의 PID, sessionId, 실행 경로(cwd), 시작 시각을 확인할 수 있다.

## 데이터 소스

- 경로: `~/.claude/sessions/*.json`
- 형식: JSON
- 스키마: `{ pid, sessionId, cwd, startedAt, kind, entrypoint }`
- 읽기 전용

## 기능

- 세션 목록 조회 (최신순 정렬)
- sessionId / cwd / pid 기준 필터링
- 상대 시각 표시 (e.g. "3h ago") + 절대 시각 툴팁
- 대시보드 카드 및 사이드바에서 접근 가능
- cwd 호버 시 퀵 액션 버튼:
  - View history — 해당 세션의 히스토리 페이지로 이동 (`/history?session=<sessionId>`)
  - CLAUDE.md — 해당 프로젝트의 CLAUDE.md 편집기로 이동
  - Copy path — 프로젝트 경로 복사
  - Copy PID — 프로세스 ID 복사
  - Copy resume command — `claude --resume <sessionId>` 명령어 복사

## API

- `GET /api/sessions` — 세션 목록 (`{ sessions, total }`)

## 관련 파일

- `app/sessions/page.tsx`
- `app/api/sessions/route.ts`
- `lib/sessions-ops.ts`
- `lib/__tests__/sessions-ops.test.ts`
