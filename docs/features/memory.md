# Memory

## 역할

Claude Code의 auto memory 파일을 프로젝트별로 조회, 편집, 생성, 삭제하는 기능.

## 데이터 소스

- 경로: `~/.claude/projects/*/memory/`
- 프로필 경로와 무관하게 항상 `~/.claude/projects/` 고정
- 각 프로젝트의 `MEMORY.md`(인덱스) + 개별 메모리 파일(YAML frontmatter + markdown body)

## 기능

- 프로젝트 목록 탐색 (메모리 유무, 파일 수 표시)
- 메모리 파일 조회 (frontmatter 파싱: name, description, type)
- 메모리 편집 (메타데이터 폼 + 마크다운 에디터)
- 메모리 생성 (자동 파일명 생성, MEMORY.md 자동 업데이트)
- 메모리 삭제 (MEMORY.md 자동 정리)
- MEMORY.md 200줄 초과 경고

## API

- `GET /api/memory?list=projects` — 프로젝트 목록
- `GET /api/memory?project={id}` — 프로젝트별 메모리 목록
- `GET /api/memory?project={id}&file={name}` — 개별 메모리 읽기
- `POST /api/memory` — 메모리 생성
- `PUT /api/memory` — 메모리 수정
- `DELETE /api/memory?project={id}&file={name}` — 메모리 삭제

## 관련 파일

- `app/memory/page.tsx` — 페이지 컨테이너
- `app/memory/_components/` — ProjectList, MemoryList, MemoryEditor, CreateMemoryModal
- `app/api/memory/route.ts` — API 라우트
- `lib/memory-ops.ts` — 핵심 파일 연산
- `lib/__tests__/memory-ops.test.ts` — 테스트
