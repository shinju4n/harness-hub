# Skills

## 역할

Claude Code 스킬을 조회한다. 플러그인에 포함된 스킬과 사용자가 직접 만든 커스텀 스킬을 구분하여 표시한다.

## 기능

- 플러그인 스킬: **마켓플레이스별** 그루핑(알파벳 순), 읽기 전용. 한 마켓플레이스 안에서 단일-스킬 plugin 과 다중-스킬 plugin 의 스킬이 평탄하게 알파벳 순으로 나열된다
- 동일 이름 plugin/skill 이 두 마켓플레이스에 있어도 marketplace 키로 구분되어 충돌하지 않음
- 뷰어 상단에 `marketplace › plugin › skill` breadcrumb 표시 (소속 정보 보존)
- 커스텀 스킬 (`~/.claude/skills/`): 마크다운 뷰어 + 인라인 편집
- Preview / Raw / Edit 모드 전환
- 데스크톱: 사이드바 + 콘텐츠 / 모바일: 리스트 ↔ 상세 전환

## 데이터 소스

| 경로 | 용도 | 편집 |
|------|------|------|
| `plugins/cache/{marketplace}/{plugin}/{version}/skills/` | 플러그인 스킬 | 읽기 전용 |
| `skills/{name}/*.md` | 커스텀 스킬 | 편집 가능 |

## API

- `GET /api/skills` — 전체 스킬 목록 (각 항목에 `marketplace`, `pluginName` 포함)
- `GET /api/skills?name=X&source=custom` — 커스텀 스킬 내용
- `GET /api/skills?name=X&source=plugin&marketplace=M&plugin=P` — 플러그인 스킬 내용 (marketplace 필수)
- `PUT /api/skills` — 커스텀 스킬 수정

## 관련 파일

- `app/skills/page.tsx`
- `app/api/skills/route.ts`
- `lib/config-reader.ts` (`readSkills`)
- `lib/__tests__/config-reader.test.ts` (그루핑 픽스처 a~g)
