# CLAUDE.md — Harness Hub

## 프로젝트 개요

Claude Code 하네스 관리 데스크톱 앱. `~/.claude/` 디렉토리의 설정 파일을 GUI로 조회/편집한다.

## 기술 스택

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + @tailwindcss/typography
- Zustand (상태 관리)
- Electron 41 (데스크톱 앱)
- Vitest (테스트)

## 개발 명령어

```bash
pnpm dev                  # 웹 개발 서버 (127.0.0.1:3000)
pnpm electron:dev         # Electron 개발 모드
pnpm build                # Next.js 빌드
pnpm electron:build:mac   # macOS .dmg 빌드
pnpm electron:build:win   # Windows .exe 빌드
pnpm vitest run --config vitest.config.node.mts  # 테스트
```

## 파일 구조 규칙

- `app/` — Next.js 페이지 (App Router)
- `app/api/` — API Route (파일시스템 접근)
- `components/` — 공유 UI 컴포넌트
- `lib/` — 핵심 유틸리티
- `stores/` — Zustand 스토어
- `electron-src/` — Electron 소스 (TypeScript)
- `electron/` — 컴파일된 Electron 출력 (gitignore)
- `docs/features/` — 기능별 문서

## 기능 추가 시 필수 사항 (HARD GATE)

새로운 페이지나 기능을 추가할 때 반드시:

1. **docs/features/{feature-name}.md** 문서를 작성한다
   - 역할, 기능, 데이터 소스, API, 관련 파일 포함
2. **README.md**의 Features 테이블에 해당 기능을 추가하고 docs 링크를 연결한다

문서 없이 기능을 커밋하지 않는다.

## 릴리즈 (HARD GATE)

버전은 `package.json`의 `version` 필드가 **single source of truth**. 다른 곳에 버전을 하드코딩하지 않는다.

- `app/api/update-check/route.ts` → `import packageJson from "@/package.json"` 으로 읽음
- `app/app-settings/page.tsx` → 동일하게 `packageJson.version` 사용
- electron-builder는 `package.json` version을 자동으로 사용

릴리즈 명령어:
```bash
pnpm release <version>    # 예: pnpm release 0.4.0
```

이 스크립트가 자동으로:
1. `package.json` version 업데이트
2. `git commit -m "release: v<version>"`
3. `git tag v<version>`
4. `git push` + `git push origin v<version>`
5. GitHub Actions가 macOS + Windows 빌드 → Release 생성

**버전을 수동으로 여러 파일에 수정하지 않는다.**

## 코딩 컨벤션

- 서버 컴포넌트 기본, 필요 시에만 `"use client"`
- Tailwind utility만 사용
- 액센트 컬러: amber 계열 (amber-500 ~ amber-800)
- API Route는 `lib/file-ops.ts`의 안전한 읽기/쓰기 유틸 사용
- JSON 쓰기 시 mtime 충돌 감지 필수
