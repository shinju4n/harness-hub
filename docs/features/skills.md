# Skills

## 역할

Claude Code 스킬을 조회한다. 플러그인에 포함된 스킬과 사용자가 직접 만든 커스텀 스킬을 구분하여 표시한다.

## 기능

- 플러그인 스킬: 플러그인별 그룹핑, 읽기 전용
- 커스텀 스킬 (`~/.claude/skills/`): 마크다운 뷰어 + 인라인 편집
- Preview / Raw / Edit 모드 전환
- 데스크톱: 사이드바 + 콘텐츠 / 모바일: 리스트 ↔ 상세 전환

## 데이터 소스

| 경로 | 용도 | 편집 |
|------|------|------|
| `plugins/cache/{marketplace}/{plugin}/{version}/skills/` | 플러그인 스킬 | 읽기 전용 |
| `skills/{name}/*.md` | 커스텀 스킬 | 편집 가능 |

## API

- `GET /api/skills` — 전체 스킬 목록
- `GET /api/skills?name=X&source=custom` — 특정 스킬 내용
- `PUT /api/skills` — 커스텀 스킬 수정

## 관련 파일

- `app/skills/page.tsx`
- `app/api/skills/route.ts`
