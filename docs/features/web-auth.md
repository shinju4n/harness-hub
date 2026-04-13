# Web Auth Middleware

## 역할

웹 모드(`HARNESS_HUB_MODE=web`)에서 인증 미들웨어를 통해 무단 접근을 차단한다. 데스크톱 모드에서는 완전 no-op.

## 기능

- 인메모리 세션 관리 (24시간 TTL)
- 로그인/로그아웃 API 엔드포인트
- Next.js 미들웨어로 모든 페이지/API 보호
- CSRF 보호 (Origin / Sec-Fetch-Site 검증)
- bcrypt 해시 또는 평문 비밀번호 지원
- robots.txt: 웹 모드에서 크롤링 차단

## 인증 제외 경로

다음 경로는 미들웨어의 세션 검사를 건너뛴다. matcher 설정과 함수 내 조기 반환으로 이중 차단하여 matcher 정규식 drift에도 로그인이 잠기지 않도록 보호한다.

- `/api/auth/login`, `/api/auth/logout` — 로그인 자체가 인증 이후에 동작하면 안 되므로 제외
- `/api/health` — 컨테이너 헬스 프로브용
- `/login` — 로그인 페이지 자체

## 환경 변수

| 변수 | 용도 |
|------|------|
| `HARNESS_HUB_MODE` | `web`이면 인증 활성화 |
| `HARNESS_HUB_AUTH` | `none`이면 인증 비활성화 |
| `HARNESS_HUB_AUTH_USER` | 로그인 사용자명 (기본값: `admin`) |
| `HARNESS_HUB_AUTH_PASS` | 평문 비밀번호 |
| `HARNESS_HUB_AUTH_PASS_HASH` | bcrypt 해시 비밀번호 (우선) |

## API

- `POST /api/auth/login` — 로그인 (세션 쿠키 발급)
- `POST /api/auth/logout` — 로그아웃 (세션 삭제)

## 관련 파일

| 파일 | 역할 |
|------|------|
| `lib/auth.ts` | 세션 관리 + requireAuth 헬퍼 |
| `middleware.ts` | Next.js 미들웨어 (인증 + CSRF) |
| `app/login/page.tsx` | 로그인 페이지 (서버 컴포넌트) |
| `components/login-form.tsx` | 로그인 폼 (클라이언트 컴포넌트) |
| `app/api/auth/login/route.ts` | 로그인 API |
| `app/api/auth/logout/route.ts` | 로그아웃 API |
| `app/robots.ts` | robots.txt 생성 |
| `lib/__tests__/auth.test.ts` | 인증 유닛 테스트 |
| `lib/__tests__/middleware.test.ts` | 미들웨어 제외 경로 회귀 테스트 |
