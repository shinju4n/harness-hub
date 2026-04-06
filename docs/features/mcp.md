# MCP Servers

## 역할

Claude Code에 연결된 MCP (Model Context Protocol) 서버 설정을 조회한다.

## 기능

- 연결된 MCP 서버 목록 표시
- 서버별 command + args 표시
- 활성 상태 뱃지

## 데이터 소스

- `.mcp.json → mcpServers` 섹션

## API

- `GET /api/mcp` — MCP 서버 목록
- `PUT /api/mcp` — MCP 서버 수정

## 관련 파일

- `app/mcp/page.tsx`
- `app/api/mcp/route.ts`
