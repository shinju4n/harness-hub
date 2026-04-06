# Keybindings

## 역할

Claude Code의 커스텀 키보드 단축키 설정을 조회하고 편집한다.

## 기능

- `~/.claude/keybindings.json` 내용을 키별 폼으로 표시
- 키 추가 / 삭제 / 수정
- JSON 형식 검증

## 데이터 소스

- `keybindings.json` — 키보드 단축키 설정 (JSON)

## API

- `GET /api/keybindings` — 키바인딩 읽기
- `PUT /api/keybindings` — 키바인딩 수정

## 관련 파일

- `app/keybindings/page.tsx`
- `app/api/keybindings/route.ts`
