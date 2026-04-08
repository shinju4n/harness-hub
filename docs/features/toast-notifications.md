# Toast Notifications

## 역할

저장·삭제·에러 등 변이(mutation) 작업의 결과를 화면 우하단에 알림으로 표시한다.

## 기능

- 성공(green), 에러(red), 정보(amber) 세 가지 종류
- 성공/정보는 3초, 에러는 5초 후 자동 닫힘
- × 버튼으로 수동 닫기
- 전역 Zustand 스토어로 관리, 어느 컴포넌트에서도 호출 가능

## 데이터 소스

인메모리 Zustand 스토어 (`stores/toast-store.ts`)

## API

없음 (클라이언트 전용)

## 관련 파일

- `stores/toast-store.ts` — Zustand 스토어 (`useToastStore`, `push`, `dismiss`)
- `components/toast-container.tsx` — 렌더 컴포넌트
- `lib/api-client.ts` — `mutate()` 헬퍼 (toast 자동 연동 래퍼)
- `app/layout.tsx` — `<ToastContainer />` 마운트
