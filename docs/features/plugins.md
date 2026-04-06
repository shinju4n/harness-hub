# Plugins

## 역할

Claude Code에 설치된 플러그인(마켓플레이스 확장)을 조회하고 활성화/비활성화를 관리한다.

## 기능

- 설치된 플러그인 목록 표시 (이름, 버전, 설치일)
- 활성화/비활성화 토글 스위치
- 데스크톱: 테이블 뷰 / 모바일: 카드 뷰

## 데이터 소스

| 파일 | 용도 |
|------|------|
| `plugins/installed_plugins.json` | 설치된 플러그인 정보 (버전, 설치일, 경로) |
| `settings.json → enabledPlugins` | 활성화 상태 (true/false) |

## API

- `GET /api/plugins` — 플러그인 목록 + 활성 상태 반환
- `PATCH /api/plugins` — 플러그인 활성/비활성 토글 (`settings.json` 수정)

## 관련 파일

- `app/plugins/page.tsx`
- `app/api/plugins/route.ts`
