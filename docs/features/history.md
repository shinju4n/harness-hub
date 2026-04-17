# History

## 역할

`~/.claude/history.jsonl`의 명령 히스토리를 조회한다. 입력했던 프롬프트/커맨드를 프로젝트별·날짜별로 필터링하며 페이지네이션으로 탐색한다.

## 데이터 소스

- 경로: `~/.claude/history.jsonl`
- 형식: JSONL
- 스키마: `{ display, pastedContents, timestamp, project, sessionId }`
- 읽기 전용
- 크기: 수 MB까지 커질 수 있으므로 스트리밍 파싱(readline) 사용

## 기능

- readline 기반 스트리밍 파싱 (`lib/history-ops.ts`)
- 프로젝트 드롭다운 필터
- 세션 ID 필터 (`?session=<sessionId>` 쿼리 파라미터 지원, Sessions 페이지에서 연결)
- 날짜(일 단위)별 그룹핑 표시
- 페이지네이션 (기본 50개, 최대 200개)
- 최신 항목이 먼저 표시 (JSONL의 append-only 특성 이용)
- 손상된 라인은 스킵

## API

- `GET /api/history?limit=50&offset=0&project=/path&session=<sessionId>` — 페이지네이션된 항목 (project, session 필터 선택적)
- `GET /api/history?projects=1` — 사용된 프로젝트 목록

## 관련 파일

- `app/history/page.tsx`
- `app/api/history/route.ts`
- `lib/history-ops.ts`
- `lib/__tests__/history-ops.test.ts`
