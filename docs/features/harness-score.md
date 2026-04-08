# Harness Score

## 역할

사용자의 Claude Code 하네스(`~/.claude/`)가 공식 권장사항과 보안 베스트
프랙티스에 얼마나 부합하는지 자동으로 채점한다. ESLint / Lighthouse 스타일의
룰 기반 점수 + 발견 항목(findings) 리스트로 대시보드에 표시되며, 카테고리별
"측정 기준" 모달에서 각 룰의 사양을 직접 확인할 수 있다.

## 출처 (모든 룰의 근거)

| 영역 | 공식 문서 |
|---|---|
| Sub-agents | https://code.claude.com/docs/en/sub-agents |
| Skills | https://code.claude.com/docs/en/skills |
| Hooks | https://code.claude.com/docs/en/hooks |
| Settings & Permissions | https://code.claude.com/docs/en/settings, https://code.claude.com/docs/en/permissions |
| Memory / CLAUDE.md | https://code.claude.com/docs/en/memory |

Anthropic이 발표한 공식 점수 루브릭은 존재하지 않는다. 본 채점기는 위 문서가
**명시적으로 경고하거나 권장하는 항목**만 룰화하고, 각 룰에 출처 URL을 첨부한다.

## 단일 진실 소스 (Single Source of Truth)

`lib/harness-score/catalog.ts`의 `RULES` 객체가 룰의 유일한 정의 지점이다.
평가 함수(`rules.ts`)는 `defineFinding(ruleId, ...)`를 통해서만 finding을
생성하며, `ruleId`는 `RuleId = keyof typeof RULES` 타입으로 제약된다. 카탈로그에
없는 ID로 finding을 만들면 **TypeScript 컴파일 에러**가 나므로 drift가 구조적으로
불가능하다.

## 점수 모델

- 카테고리 5개: `agents`, `skills`, `hooks`, `permissions`, `memory`
- 각 카테고리는 100점 만점에서 시작, 위반된 룰의 가중치만큼 차감
- **전체 점수** = 카테고리 평균 (정수 반올림)
- 룰 심각도:
  - `error` — 보안/공식 Warning 위반 (-15)
  - `warn` — 베스트 프랙티스 위반 (-7)
  - `info` — 최적화 힌트 (-3)
- 카테고리에 평가 대상이 0개이고 finding도 0개면 100점 대신 `n/a`
- **같은 ruleId가 여러 항목에서 발동해도 점수에는 최대 3회까지만 반영**
  (20개 에이전트가 같은 옵션을 빠뜨린 건 1가지 패턴 이슈이지 20가지 별개
  이슈가 아니므로). 발견 항목은 UI에 모두 표시된다.

## 룰 카탈로그

상세 사양은 `catalog.ts`가 단일 진실 소스이므로 아래 표는 요약. 실제 값(severity,
title, rationale, docsUrl)이 변경되면 모달이 자동으로 반영한다.

### Agents
`agent/name-format` (warn), `agent/description-missing` (error),
`agent/description-too-short` (warn), `agent/no-tool-whitelist` (info),
`agent/bypass-permissions` (error), `agent/opus-on-readonly` (info)

### Skills
`skill/missing-skill-md` (error), `skill/description-missing` (warn),
`skill/description-too-long` (warn), `skill/name-too-long` (warn),
`skill/file-too-long` (info)

### Hooks
`hook/curl-pipe-shell` (error), `hook/dangerous-bypass` (error),
`hook/no-timeout` (info)

### Permissions
`perm/no-settings` (error), `perm/missing-schema` (info),
`perm/bypass-default-mode` (error), `perm/bash-wildcard-allow` (error),
`perm/curl-allow` (warn), `perm/no-env-deny` (error)

### Memory / CLAUDE.md
`memory/no-claude-md` (warn), `memory/file-too-long` (warn),
`memory/vague-instructions` (info)

## 데이터 소스

- `~/.claude/agents/*.md` — gray-matter로 프론트매터 파싱
- `~/.claude/skills/<name>/SKILL.md` — 동일
- `~/.claude/settings.json` — 기존 `readJsonFile`
- `~/.claude/CLAUDE.md` — **사용자 스코프만**. Harness Hub는 "현재 프로젝트"
  개념이 없는 데스크톱 앱이므로 프로젝트 스코프 CLAUDE.md는 채점하지 않는다
  (이전 버전이 `~/CLAUDE.md`를 잘못 "project"로 라벨링하던 버그를 제거).

## API

- **GET** `/api/harness-score` → `ScoreReport`
- 헤더: 표준 `x-claude-home` 프로필 전환 지원
- `export const dynamic = "force-dynamic"` — Next.js 캐시 비활성화

```ts
type Severity = "error" | "warn" | "info";
type Category = "agents" | "skills" | "hooks" | "permissions" | "memory";

interface Finding {
  ruleId: string;
  category: Category;
  severity: Severity;
  message: string;
  target?: string;
  docsUrl: string;
}

interface CategoryScore {
  category: Category;
  score: number | null; // null = n/a
  evaluated: number;
  findings: Finding[];
}

interface ScoreReport {
  overall: number | null;
  categories: CategoryScore[];
  generatedAt: string;
}
```

## UI

- **HarnessScorePanel** — 대시보드 상단. overall 점수 + 카테고리 5개 카드 +
  새로고침 버튼 + 발견 항목 펼침/접힘 리스트.
- 각 카테고리 카드는 클릭 가능하며, 클릭 시 해당 카테고리의 룰만 보여주는
  `ScoringCriteriaModal`이 열린다.
- **ScoringCriteriaModal** — 카테고리 필터, ESC/배경 클릭 닫힘, focus trap,
  body scroll lock, 룰별 docs 링크. `category` prop이 없으면 전체 룰 표시.

## 관련 파일

- `lib/harness-score/catalog.ts` — 룰 카탈로그 (단일 진실 소스, typed `RULES`)
- `lib/harness-score/types.ts` — 타입 + `isHookMap` 가드
- `lib/harness-score/labels.ts` — UI 공유 라벨/색상/pluralize 헬퍼
- `lib/harness-score/rules.ts` — 평가 함수 (`defineFinding`만 사용)
- `lib/harness-score/runner.ts` — 스캐너 + 점수 집계
- `lib/__tests__/harness-score.test.ts` — 39개 단위/통합 테스트
- `app/api/harness-score/route.ts` — API
- `components/harness-score-panel.tsx` — 대시보드 패널
- `components/scoring-criteria-modal.tsx` — 카테고리별 측정 기준 모달
- `app/page.tsx` — 패널 마운트 지점

## 제약 / 비목표

- 네트워크 호출 없음. 전부 로컬 파일 분석.
- 룰은 read-only — 자동 수정(quick fix)은 v1 범위 외.
- 프로젝트 스코프 CLAUDE.md는 채점하지 않음 (위 데이터 소스 참고).
- 점수는 권고용. Anthropic 공식 인증이 아님을 패널에 명시.
