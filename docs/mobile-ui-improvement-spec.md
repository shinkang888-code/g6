# LawyGo 모바일 UI 가독성 개선 개발명세서

> 작성 기준: 2026-06-11  
> 대상 화면: 사건 관리(`/cases`) 및 앱 전반 모바일 뷰 (`max-lg`, 1024px 미만)  
> 참고 스크린샷: 모바일 Chrome — 사건 1행만 보이고 테이블·툴바·하단 패널이 과밀

---

## 1. 문제 요약

| 영역 | 현상 | 원인 (코드) |
|------|------|-------------|
| 사건 목록 | 세로 1행 수준만 보임 | 목록(`flex-1`)과 하단 메모·자료실(`min-h-[140px] max-h-[320px]`)이 **같은 flex 컬럼**에서 공간 분할 |
| 사건 테이블 | 사건명 세로 한 글자씩 표시 | 11열 고정 테이블 + `text-xs` + 모바일 가로폭 부족 |
| 상단 툴바 | 버튼·필터 과밀 | 검색 2개 + 필터 4개 + 액션 8개가 **한 줄 wrap** (`page.tsx` L543–671) |
| 하단 패널 | 메모·자료실이 목록을 밀어냄 | 모바일에서도 항상 표시 (`max-h-[320px]`) |
| 전역 | 터치 영역 작음 | `Button size="xs"`, `text-2xs` 다수 |

---

## 2. 목표

1. **(필수)** 사건 목록 프레임 세로 높이를 **현재 대비 4배**로 확보하고, 목록 영역 **내부 스크롤**로 여러 건을 볼 수 있게 한다.
2. 모바일에서 **읽기·탭·스크롤**이 가능한 최소 가독성 기준을 전 화면에 적용한다.
3. 데스크톱(`lg:` 이상) 레이아웃·동작은 **변경 없음** (회귀 방지).

---

## 3. 디자인 토큰 (모바일 전용)

| 항목 | 현재 | 모바일 목표 |
|------|------|-------------|
| 본문 글자 | `text-xs` (12px) | `text-sm` (14px) 최소 |
| 라벨/캡션 | `text-2xs` (~10px) | `text-xs` (12px) 최소 |
| 터치 타깃 | ~28px | **44px** 이상 (WCAG 2.5.5) |
| 행 높이 (테이블/리스트) | `py-2.5` | `py-3` 이상 (`min-h-[48px]`) |
| 페이지 하단 여백 | `pb-16` (MobileNav) | `pb-[calc(4rem+env(safe-area-inset-bottom))]` 유지·보강 |

Tailwind 브레이크포인트: **`lg:` = 1024px** (사이드바 표시 기준과 동일).

---

## 4. Phase 0 — 사건 목록 세로 4배 확대 (필수, 최우선)

### 4.1 현재 구조

```
src/app/cases/page.tsx
└─ div.flex.flex-col.h-full
   ├─ header (shrink-0)           ← 툴바
   ├─ div.flex-1.min-h-0          ← 사건 목록 (가변, often ~100px on mobile)
   └─ div.min-h-[140px].max-h-[320px]  ← 메모 + 자료실 (항상 표시)
```

모바일에서 목록 가시 높이 ≈ **뷰포트 − GNB − 툴바 − 하단패널(140~320) − MobileNav** → **약 80~120px** (1행).

### 4.2 목표 구조 (모바일)

```
└─ div.flex.flex-col.h-full
   ├─ header (shrink-0, 모바일에서 접기 가능)
   ├─ div.[목록 프레임]           ← min-height = 현재 × 4, overflow-y-auto
   └─ div.[하단 패널]             ← 모바일: 접힘 기본 또는 탭 전환
```

**목표 가시 높이:** 현재 ~100px → **최소 400px** (4배).  
뷰포트가 작을 때는 `min(400px, 55dvh)` 등으로 유연 적용.

### 4.3 구현 명세

**파일:** `src/app/cases/page.tsx`

#### A. 목록 컨테이너 (L675 부근)

```tsx
// Before
<div className="flex-1 min-h-0 overflow-auto">

// After
<div
  className={cn(
    "flex-1 min-h-0 overflow-y-auto overscroll-contain",
    // 모바일: 4배 높이 보장 (현재 ~100px → min 400px)
    "max-lg:min-h-[400px] max-lg:max-h-[min(560px,58dvh)]",
    "max-lg:flex-[4] max-lg:shrink-0"
  )}
>
```

- `overflow-y-auto`: 목록 **프레임 안에서** 세로 스크롤.
- `overscroll-contain`: 바디 전체 스크롤과 분리.
- `flex-[4]`: 하단 패널 대비 목록이 **4배 비중** 차지.

#### B. 하단 메모·자료실 (L1048 부근)

```tsx
// Before
<div className="... min-h-[140px] max-h-[320px] shrink overflow-hidden">

// After
<div
  className={cn(
    "border-t border-slate-200 bg-slate-50 px-4 py-3 grid gap-3 shrink overflow-hidden",
    "grid-cols-1 lg:grid-cols-2",
    // 데스크톱: 기존
    "lg:min-h-[140px] lg:max-h-[320px]",
    // 모바일: 접힘 기본, 펼치면 1패널만
    "max-lg:min-h-0 max-lg:max-h-[140px] max-lg:flex-[1]"
  )}
>
```

**모바일 UX 보강 (권장, 동일 Phase):**

- `useState<"list" | "memo" | "docs">` 탭 추가 (`max-lg` only).
- 기본 탭 = **목록** (메모·자료실은 「메모」「자료」버튼 탭 시 전체 화면 시트로).
- 사건 행 탭 시 하단 시트(`Drawer`)로 메모·자료실 표시 → 목록 높이 유지.

#### C. 모바일 기본 보기 모드

```tsx
// 초기 viewMode: lg 미만이면 "card", 이상이면 "table"
const [viewMode, setViewMode] = useState<"table" | "card">(
  () => (typeof window !== "undefined" && window.innerWidth < 1024 ? "card" : "table")
);
```

카드 뷰는 이미 구현됨 (L862–940). 모바일 기본값을 **card**로 두면 테이블 11열 문제 완화.

### 4.4 수용 기준 (Phase 0)

- [ ] iPhone SE급(375×667)에서 사건 목록 영역 **최소 400px** 세로 확보.
- [ ] 목록 내부 스크롤로 **동시에 5건 이상** 식별 가능 (카드 또는 행).
- [ ] 하단 MobileNav와 겹치지 않음.
- [ ] 데스크톱(`lg+`) 레이아웃 픽셀 단위 동일 (스크린샷 비교).

---

## 5. Phase 1 — 사건 관리 화면 모바일 개선

### 5.1 상단 툴바 재구성

**파일:** `src/app/cases/page.tsx` (L543–671)

| 구분 | 모바일 | 데스크톱 |
|------|--------|----------|
| 1행 | 제목 + 건수 + 검색 1개 + 「필터」버튼 | 현행 유지 |
| 2행 (접힘) | 담당 검색, 필터 칩, 액션 | — |
| 액션 | 「더보기 ⋮」시트에 편집·삭제·이력·엑셀·연동 묶기 | 현행 유지 |

**신규 컴포넌트 (권장):**

- `src/components/cases/CasesMobileToolbar.tsx` — 모바일 전용 2단 툴바 + 액션 시트.

### 5.2 테이블 → 모바일 리스트 카드 (table 모드 유지 시)

테이블 모드를 모바일에서도 쓸 경우:

**파일:** `src/components/cases/CaseMobileTable.tsx` (신규)

| 표시 열 | 숨김 열 |
|--------|--------|
| 사건번호, 사건명, 의뢰인, 다음기일, 상태 | 종류, 기관, 지위, 담당, 보조, 연동 |

- 가로 스크롤 대신 **2줄 카드형 행** (`min-h-[56px]`).
- 사건명 `line-clamp-2`, `text-sm font-medium`.

### 5.3 페이지네이션

- 모바일: 페이지 번호 40개 나열 제거 → **이전 / 현재/전체 / 다음**만 (`page.tsx` L943–1004).
- `PAGE_SIZE` 모바일 20 → **15** (한 화면 밀도 조절, 선택).

### 5.4 FilterTray

**파일:** `src/components/cases/FilterTray.tsx`

- 모바일: 필터 버튼 터치 영역 `min-h-[44px]`, 팝오버 **전체 너비 bottom sheet**.
- 활성 필터 칩: `text-sm`, 삭제(X) 버튼 44px.

---

## 6. Phase 2 — 앱 공통 레이아웃

### 6.1 AuthLayout

**파일:** `src/components/layout/AuthLayout.tsx`

```tsx
// main 영역
<main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
```

- 사건 페이지는 `h-full` flex이므로 `main`에 `flex flex-col min-h-0` 추가 검토.
- `/cases`만 `main` 자식이 뷰포트 높이를 꽉 채우도록:

```tsx
<main className={cn("flex-1 overflow-y-auto ...", pathname === "/cases" && "flex flex-col min-h-0 overflow-hidden")}>
```

### 6.2 Header (모바일)

**파일:** `src/components/layout/Header.tsx`

- 검색창: 모바일에서 아이콘 탭 시 **전체 화면 검색 오버레이**.
- 알림·프로필: 터치 44px.
- GNB 높이: `--gnb-height: 52px` (모바일), 60px (데스크톱).

### 6.3 MobileNav

**파일:** `src/components/layout/MobileNav.tsx`

- 탭 라벨 `text-2xs` → `text-xs`.
- `min-w-[56px]` → `min-h-[48px]` 유지, 아이콘+라벨 간격 확대.
- `safe-area-pb` 전역 적용 확인 (`globals.css`).

---

## 7. Phase 3 — 기타 화면별 개선

### 7.1 대시보드 `/`

- KPI 카드: `grid-cols-2` (모바일), 숫자 `text-2xl`.
- 위젯 테이블: Phase 1과 동일 **모바일 카드 행** 패턴 재사용.

### 7.2 게시판 `/board`

- 목록: 제목 `text-sm font-medium`, 메타 `text-xs`, 행 `py-3`.
- 에디터: 모바일 툴바 아이콘 44px, 본문 `text-base` (입력 시 줌 방지 `text-base` on inputs).

### 7.3 결재 `/approval`

- 결재선·문서 목록: 카드형, 상태 뱃지 크기 확대.
- 상세: 고정 하단 CTA (승인/반려) `sticky bottom-[4rem]`.

### 7.4 로그인 `/login`

- 입력 필드 `py-3 text-base` (iOS 자동줌 방지).
- DEMO·Google 버튼 `min-h-[48px]`.

### 7.5 관리자 `/admin/*`

- 사건관리 엑셀 업로드: 모바일에서 파일 선택 + 미리보기 모달 **전체 화면**.
- 설정 테이블: label/value **세로 스택** (`max-lg:flex-col`).

### 7.6 캘린더 `/calendar`

- 월간 뷰: 셀 최소 높이 확대, 기일 점 → **숫자 뱃지**.
- 주간/일간: 기본 뷰를 모바일에서 **일간 리스트**.

---

## 8. 공통 컴포넌트 변경

| 컴포넌트 | 변경 |
|----------|------|
| `Button` | `size="xs"` 모바일에서 `min-h-[40px]` 오버라이드 옵션 `touchFriendly` |
| `CaseRowSkeleton` | 모바일 높이 48px |
| `StatusBadge`, `DDayBadge` | `text-xs` → 모바일 `text-sm` |
| `toast` | 모바일 하단 MobileNav 위에 표시 (`bottom-20`) |

**신규 유틸 (권장):**

- `src/hooks/useIsMobile.ts` — `matchMedia('(max-width: 1023px)')`
- `src/components/ui/MobileBottomSheet.tsx` — 메모·자료실·필터 공용

---

## 9. 구현 우선순위·일정 (권장)

| 순서 | Phase | 예상 | 산출물 |
|------|-------|------|--------|
| 1 | **Phase 0** | 0.5~1일 | 목록 4배 높이 + 내부 스크롤 |
| 2 | Phase 1-A | 1일 | 툴바 접기 + 모바일 card 기본 |
| 3 | Phase 1-B | 1일 | 메모·자료 탭/시트 분리 |
| 4 | Phase 2 | 0.5일 | Layout·Header·MobileNav |
| 5 | Phase 3 | 2~3일 | 화면별 순차 적용 |

---

## 10. 테스트 체크리스트

### 기기

- [ ] iPhone SE (375px)
- [ ] iPhone 14 (390px)
- [ ] Galaxy S 시리즈 (360px)
- [ ] iPad 세로 (768px) — `lg` 미만이면 모바일 규칙 적용

### 시나리오 (사건 관리)

- [ ] 784건 목록 스크롤·페이지 이동
- [ ] 사건 선택 → 메모 입력 (키보드 올라와도 목록/입력 가림 없음)
- [ ] 필터 3개 적용 후 목록 높이 유지
- [ ] 가로 회전(landscape) 시 목록 min-height 유지

### 회귀

- [ ] 데스크톱 1280px+ UI 동일
- [ ] 엑셀 import/export, 기일연동 버튼 동작

---

## 11. 변경 파일 맵

| 우선순위 | 파일 | 변경 내용 |
|----------|------|-----------|
| P0 | `src/app/cases/page.tsx` | 목록 min-height 4배, overflow, 하단 패널 모바일 축소/탭 |
| P0 | `src/components/layout/AuthLayout.tsx` | `/cases` full-height flex |
| P1 | `src/components/cases/CasesMobileToolbar.tsx` | 신규 |
| P1 | `src/components/cases/CaseMobileTable.tsx` | 신규 (선택) |
| P1 | `src/components/cases/FilterTray.tsx` | bottom sheet |
| P2 | `src/components/layout/Header.tsx` | 모바일 검색·터치 |
| P2 | `src/components/layout/MobileNav.tsx` | 라벨·safe-area |
| P2 | `src/app/globals.css` | 모바일 GNB 높이, safe-area |
| P3 | `src/app/board/page.tsx` 등 | 화면별 카드형 목록 |

---

## 12. Phase 0 즉시 적용 코드 스니펫 (요약)

개발자가 바로 착수할 수 있도록 **필수 변경만** 요약:

```tsx
// src/app/cases/page.tsx — 목록 영역
<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain max-lg:min-h-[400px] max-lg:max-h-[min(560px,58dvh)] max-lg:flex-[4]">

// 하단 패널
<div className="border-t ... max-lg:max-h-[120px] max-lg:overflow-hidden lg:min-h-[140px] lg:max-h-[320px]">

// viewMode 초기값 (useEffect로 resize 대응 가능)
useEffect(() => {
  const mq = window.matchMedia("(max-width: 1023px)");
  const apply = () => setViewMode(mq.matches ? "card" : "table");
  apply();
  mq.addEventListener("change", apply);
  return () => mq.removeEventListener("change", apply);
}, []);
```

---

## 13. 비고

- 스크린샷 기준 **테이블 모드 + 하단 메모·자료실 동시 표시**가 가독성 저하의 직접 원인이다.
- Phase 0만 적용해도 체감 개선이 크며, Phase 1~3은 점진 배포 가능.
- 구현 후 **lawygo.vercel.app** 모바일 실기기 검증 필수.
