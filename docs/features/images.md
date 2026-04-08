# Images

## 역할

Claude Code 대화에서 사용자가 첨부했던 모든 이미지를 한 화면에 모아 본다. 어느 세션의 어느 메시지에서 왔는지 출처와 함께 표시된다.

## 기능

- **그리드 뷰**: 모든 세션/프로젝트에서 사용된 이미지를 썸네일 그리드로 표시
- **라이트박스**: 썸네일 클릭 시 원본 크기 모달 (Esc로 닫기, 배경 클릭으로 닫기)
- **출처 표시**: 라이트박스 하단에 프로젝트 경로, 세션 ID, 캡처 시각, MIME 타입, 추정 크기
- **프로젝트 필터**: 상단 드롭다운으로 특정 프로젝트의 이미지만 보기 (각 프로젝트의 이미지 개수 표시)
- **페이지네이션**: 한 페이지당 60개. 너무 많은 base64 디코딩으로 브라우저가 느려지지 않게 의도적으로 작게 잡음
- **lazy loading**: `<img loading="lazy">` — 화면 밖 이미지는 실제로 fetch되지 않음
- **프로필 인식**: 활성 프로필의 `homePath`에 있는 jsonl을 스캔. 프로필 전환 시 자동으로 새 경로의 이미지로 다시 로드

## 데이터 소스

이미지는 별도 디렉토리에 저장되지 않는다. **Claude Code는 사용자가 첨부한 이미지를 세션 jsonl 안에 base64로 인라인한다**:

```jsonc
// ~/.claude/projects/<encodedCwd>/<sessionId>.jsonl 의 한 줄
{
  "type": "user",
  "uuid": "...",
  "timestamp": "2026-04-05T08:54:59.748Z",
  "cwd": "/Users/me/Documents/wedding",
  "sessionId": "6a01b47b-...",
  "message": {
    "role": "user",
    "content": [
      { "type": "text", "text": "이거 봐줘" },
      {
        "type": "image",
        "source": {
          "type": "base64",
          "media_type": "image/png",
          "data": "iVBORw0KG..."
        }
      }
    ]
  }
}
```

`lib/images-ops.ts`가 모든 jsonl을 줄 단위로 스트리밍하면서 `"type":"image"` 부분 문자열을 가진 줄만 골라 `JSON.parse`한 뒤 `image` 블록을 추출한다. 큰 세션 파일(수백 MB)도 메모리에 한꺼번에 올리지 않는다.

## 이미지 ID 설계

`/api/images` 응답에는 base64 데이터를 포함하지 않는다 — 메타데이터만 보낸다. 각 항목에는 `id` 필드가 있고, 이는 `(projectDir, fileName, messageUuid, blockIndex)`를 합쳐 base64url로 인코딩한 안정적인 식별자다. 그리드의 각 `<img>`는 `/api/images/<id>` URL을 직접 가리키고, 그 라우트가 호출 시점에 jsonl을 다시 스트리밍해서 해당 블록의 base64만 디코딩해 바이트로 응답한다.

이렇게 하면:

- 목록 응답이 가벼움 (수천 장이라도 KB 단위)
- `<img>`가 브라우저 캐시를 그대로 활용 (Cache-Control: private, max-age=3600)
- 별도의 캐시 디렉토리가 필요 없음

## API

| Endpoint | Method | 용도 |
|---|---|---|
| `/api/images?limit=&offset=&project=` | GET | 메타데이터 페이지 (timestamp 내림차순) |
| `/api/images?facets=projects` | GET | 프로젝트별 이미지 개수 (필터 드롭다운용) |
| `/api/images/<id>?home=...` | GET | 특정 이미지의 원본 바이트 (`Content-Type: <media_type>`) |

`/api/images/<id>`는 `<img>`가 헤더를 못 보내므로 `?home=` 쿼리 파라미터로 활성 프로필을 받는다 (헤더가 있으면 헤더 우선). `lib/claude-home.ts`의 위생 검사를 그대로 거친다.

## 관련 파일

- `app/images/page.tsx` — 그리드 + 필터 + 라이트박스 UI
- `app/api/images/route.ts` — 목록/페이지네이션/프로젝트 facets
- `app/api/images/[id]/route.ts` — 단건 바이트 응답
- `lib/images-ops.ts` — jsonl 스트리밍 파서, 이미지 추출, ID 인코딩/디코딩
- `components/sidebar.tsx` — 사이드바 네비 항목

## 알려진 제약

- **읽기 전용**: 삭제는 지원하지 않음. 이미지를 지우려면 세션 jsonl을 직접 편집해야 한다 — 같은 메시지의 다른 컨텐츠 블록까지 의도치 않게 건드릴 위험이 커서 의도적으로 범위 밖.
- **`projectLabel`은 best-effort**: jsonl 내 첫 번째 user/assistant 레코드의 `cwd`에서 가져온다. 일부 파일은 cwd 필드가 없어 디렉토리명 인코딩(`-Users-me-...`)을 그대로 보여준다.
- **세션 jsonl이 유저 손에 의해 수정되면** 같은 메시지 안의 `blockIndex`가 어긋나 라이트박스가 404가 될 수 있다. 그 경우 페이지를 새로고침하면 새 인덱스로 다시 표시된다.
- **이미지가 별도 파일로 저장되는 케이스는 미지원**: 현재 Claude Code는 base64 인라인만 사용. 추후 별도 디렉토리 저장 방식이 도입되면 `lib/images-ops.ts`에 두 번째 데이터 소스를 추가해야 한다.
