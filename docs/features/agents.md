# Agents

## 역할

Claude Code 서브에이전트 정의 파일을 조회하고 편집한다. 팀 에이전트의 인박스 메시지도 확인할 수 있다.

## 탭 구성

### Definitions 탭

`~/.claude/agents/*.md` 파일을 읽어서 에이전트 정의를 표시한다.

**표시 정보:**
- name, description (frontmatter)
- model, memory, color, effort, tools 등 메타데이터
- 시스템 프롬프트 (마크다운 본문)
- scope 뱃지 (user/project)

**편집:** 인라인 마크다운 편집 후 저장 가능

### Team Inboxes 탭

`~/.claude/teams/{team}/inboxes/*.json` 파일을 읽어서 팀 에이전트 간 메시지를 표시한다.

**표시 정보:**
- 팀/에이전트 이름
- 메시지 목록 (from, text, summary, timestamp)
- 읽지 않은 메시지 뱃지

## 에이전트 정의 파일 형식

```yaml
---
name: code-reviewer
description: Reviews code for quality and security
tools: Read, Grep, Glob
model: sonnet
memory: project
color: blue
---

You are a senior code reviewer...
```

## 데이터 소스

| 경로 | 용도 |
|------|------|
| `agents/*.md` | 에이전트 정의 (YAML frontmatter + 마크다운) |
| `teams/{team}/inboxes/*.json` | 팀 에이전트 메시지 |

## API

- `GET /api/agents?tab=definitions` — 에이전트 정의 목록
- `GET /api/agents?tab=definitions&name=X` — 특정 에이전트 내용
- `GET /api/agents?tab=teams` — 팀 인박스 메시지
- `PUT /api/agents` — 에이전트 정의 수정

## 관련 파일

- `app/agents/page.tsx`
- `app/api/agents/route.ts`
