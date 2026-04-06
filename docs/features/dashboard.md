# Dashboard

## 역할

Harness Hub의 메인 화면. Claude Code 하네스의 전체 상태를 한눈에 파악할 수 있는 요약 대시보드.

## 기능

- `~/.claude/` 디렉토리를 스캔하여 각 카테고리별 항목 수를 카드로 표시
- 각 카드 클릭 시 해당 상세 페이지로 이동
- 에러 발생 시 에러 메시지 표시

## 표시 항목

| 카드 | 데이터 소스 | 표시 내용 |
|------|-----------|---------|
| Plugins | `plugins/installed_plugins.json` + `settings.json` | 설치 수 / 활성 수 |
| Skills | `plugins/cache/` + `skills/` | 총 스킬 수 |
| Commands | `commands/*.md` | 커맨드 수 |
| Hooks | `settings.json → hooks` | 훅 수 |
| MCP Servers | `.mcp.json` | 서버 수 |
| Agents | `agents/*.md` | 에이전트 정의 수 |
| Rules | `rules/*.md` | 규칙 수 |
| CLAUDE.md | `CLAUDE.md` | 존재 여부 |

## 관련 파일

- `app/page.tsx` — 대시보드 페이지
- `lib/config-reader.ts` — 전체 설정 읽기
- `stores/config-store.ts` — Zustand 상태 관리
- `app/api/config/route.ts` — API 엔드포인트
