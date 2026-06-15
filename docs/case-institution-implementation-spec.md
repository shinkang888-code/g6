# 사건 계속기관(진행단계별 연락처) 구현 명세

> LawTop GL `사건기초정보 > 상세`의 **계속기관·당사자** 구조를 LawyGo에 단계적으로 반영하기 위한 설계서  
> 작성 기준: 2026-06-09 코드베이스

---

## 0. 목표

한 사건 안에서 **수사(경찰) → 검찰 → 1심 → 2심 → 3심** 진행에 따라

- 기관명·사건번호·담당부서·담당자
- **전화 / 휴대 / 팩스 / 이메일 / 호실**

을 **단계별로 분리 저장·조회**할 수 있게 한다.

---

## 1. 구현 순서 (권장 로드맵)

| 단계 | 이름 | 기간(추정) | 산출물 |
|------|------|-----------|--------|
| **Sprint 1** | Phase A — 기존 자산 연결 | 2~3일 | `court_division`·`clients` API 연동, 등록/수정 폼 보강 |
| **Sprint 2** | Phase B-1 — DB·API | 2~3일 | `case_institutions` 마이그레이션, CRUD API |
| **Sprint 3** | Phase B-2 — UI | 3~5일 | 사건등록/수정/상세 **계속기관 탭** |
| **Sprint 4** | Phase B-3 — 엑셀·이관 | 2일 | LawTop 엑셀 매핑, 기존 `notes` 파싱 이관 |
| **Sprint 5** | Phase C — 당사자 확장 | 3~4일 | `case_parties` 다중 의뢰인·상대방 |

아래 **2→3→4절**이 각 Sprint의 상세 설계이다.

---

## 2. Sprint 1 — Phase A (즉시 가능, 신규 테이블 없음)

### 2.1 `court_division` 컬럼 UI·API 연결

**현황**

- DB: `cases.court_division` 컬럼 존재 (`20260610020000_cases_court_division.sql`)
- API 목록: `fromRow`에 `courtDivision` 매핑됨 (`/api/admin/cases`)
- **누락**: `caseItemToDbRow`, 등록/수정 폼, 단건 PATCH, `CaseItem` 타입

**작업**

| 파일 | 변경 |
|------|------|
| `src/lib/types.ts` | `CaseItem`에 `courtDivision?: string` 추가 |
| `src/lib/caseImportServer.ts` | `caseItemToDbRow`에 `court_division` 매핑 |
| `src/app/api/admin/cases/[id]/route.ts` | PATCH·fromRow에 `courtDivision` |
| `src/app/cases/new/page.tsx` | 「재판부·기관연락처」textarea (placeholder: LawTop 형식 안내) |
| `src/app/cases/[id]/edit/page.tsx` | 동일 필드 |
| `src/app/cases/[id]/page.tsx` | 좌측 패널 「기관연락처」행 (`formatCourtDivisionContactLine`) |
| `src/lib/caseExcel.ts` | `buildNotes` 대신 `court_division` 컬럼에 직접 저장 |

**UI 필드**

```
재판부·기관연락처 (선택)
placeholder: 제 3 형사부(나) (전화:031-828-0421)
```

**완료 기준**

- [ ] 신규 등록 시 `court_division` DB 저장
- [ ] 엑셀 `계속부서` → `court_division` (notes 중복 없음)
- [ ] 사건 상세에서 연락처 한 줄 표시

---

### 2.2 의뢰인 → Supabase `clients` 동기화

**현황**

- `public.clients` 테이블·`/api/admin/clients` CRUD **이미 존재**
- `cases.client_id` FK 존재하나 등록 시 **미사용**
- 사건 등록은 `clientStorage` (localStorage)만 갱신

**작업**

| 파일 | 변경 |
|------|------|
| `src/lib/caseClientSync.ts` *(신규)* | 이름·연락처로 upsert, `client_id` 반환 |
| `src/app/cases/new/page.tsx` | submit 전 `POST /api/admin/clients` 또는 upsert 헬퍼 |
| `src/app/api/admin/cases/route.ts` | POST body에 `clientId` 수용 → `client_id` 저장 |
| `src/lib/caseImportServer.ts` | import 시에도 client upsert (선택, Sprint 4로 미룰 수 있음) |

**upsert 규칙**

1. `guest_code` 있으면 guest_code 우선 매칭
2. 없으면 `name` + (`contact_mobile` OR `contact_phone`) 매칭
3. 없으면 INSERT 후 `client_id` 연결

**완료 기준**

- [ ] 사건 등록 후 `cases.client_id` NOT NULL (의뢰인 입력 시)
- [ ] 고객관리(`/admin/clients`)에서 동일 인물 조회 가능
- [ ] localStorage는 캐시 fallback으로 유지 (오프라인·기존 화면 호환)

---

### 2.3 `cases` 보조 필드 (LawTop 기초사항 일부)

Sprint 1에서 같이 넣기 쉬운 컬럼:

```sql
-- supabase/migrations/20260611000001_cases_trial_meta.sql
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS trial_level TEXT,          -- 심급: 1심|2심|3심|기타
  ADD COLUMN IF NOT EXISTS management_key TEXT,       -- LawTop 키값
  ADD COLUMN IF NOT EXISTS active_stage TEXT;         -- 현재 진행 단계 (UI 기본 탭)

COMMENT ON COLUMN public.cases.trial_level IS '대표 심급 (목록·필터용)';
COMMENT ON COLUMN public.cases.management_key IS 'LawTop 키값 (J202510100018 등)';
COMMENT ON COLUMN public.cases.active_stage IS '현재 계속기관 단계 (police|prosecution|court_1|...)';
```

등록 폼에 **심급** select, **관리키** text (선택) 추가.

---

## 3. Sprint 2 — Phase B-1: DB 마이그레이션 초안

### 3.1 `case_institutions` 테이블

LawTop 「계속기관」 탭 1개 = 레코드 1행.

```sql
-- supabase/migrations/20260611000000_case_institutions.sql

CREATE TYPE public.case_institution_stage AS ENUM (
  'police',        -- 수사기관(경찰)
  'prosecution',   -- 수사기관(검찰)
  'court_1',       -- 1심
  'court_2',       -- 2심
  'court_3',       -- 3심
  'detention'      -- 구금 (부가)
);

CREATE TABLE IF NOT EXISTS public.case_institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  stage public.case_institution_stage NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,

  agency_name TEXT,           -- 기관명 (안산지청, 인천지법 등)
  case_number TEXT,           -- 해당 단계 사건번호 (2025형제32065)
  case_name TEXT,             -- 사건명 (사기)
  department TEXT,            -- 담당부서 (형사3부)
  contact_name TEXT,          -- 담당자 (양종화 검사)
  phone TEXT,
  mobile TEXT,
  fax TEXT,
  email TEXT,
  room TEXT,                  -- 호실 (611)
  notes TEXT,

  -- 구금 전용 (stage=detention 일 때)
  detention_agency TEXT,
  detention_number TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (case_id, stage)
);

CREATE INDEX idx_case_institutions_case_id ON public.case_institutions(case_id);
CREATE INDEX idx_case_institutions_stage ON public.case_institutions(stage);

DROP TRIGGER IF EXISTS case_institutions_updated_at ON public.case_institutions;
CREATE TRIGGER case_institutions_updated_at
  BEFORE UPDATE ON public.case_institutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case_institutions_authenticated_all"
  ON public.case_institutions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

**설계 결정**

| 항목 | 결정 | 이유 |
|------|------|------|
| `(case_id, stage)` UNIQUE | 채택 | 단계당 1세트 (LawTop 탭 구조) |
| `cases.court` | 유지 | **현재 활성** 기관명 스냅샷·목록 필터용 |
| `cases.case_number` | 유지 | **대표** 사건번호 (보통 최신 심급) |
| 심급별 사건번호 | `case_institutions.case_number` | 1·2·3심 번호 각각 다름 |

**`cases.court` 동기화 규칙** (저장 시 서버)

```
active_stage 레코드가 있으면 cases.court ← agency_name
active_stage 레코드.case_number 있으면 cases.case_number ← (선택, 사용자 확인 후)
```

---

### 3.2 TypeScript 타입

```typescript
// src/lib/caseInstitutionTypes.ts

export type CaseInstitutionStage =
  | "police"
  | "prosecution"
  | "court_1"
  | "court_2"
  | "court_3"
  | "detention";

export const CASE_INSTITUTION_STAGES: {
  value: CaseInstitutionStage;
  label: string;
  shortLabel: string;
}[] = [
  { value: "police", label: "수사기관 (경찰)", shortLabel: "경찰" },
  { value: "prosecution", label: "수사기관 (검찰)", shortLabel: "검찰" },
  { value: "court_1", label: "법원 (1심)", shortLabel: "1심" },
  { value: "court_2", label: "법원 (2심)", shortLabel: "2심" },
  { value: "court_3", label: "법원 (3심)", shortLabel: "3심" },
  { value: "detention", label: "구금", shortLabel: "구금" },
];

export interface CaseInstitution {
  id: string;
  caseId: string;
  stage: CaseInstitutionStage;
  sortOrder: number;
  agencyName?: string;
  caseNumber?: string;
  caseName?: string;
  department?: string;
  contactName?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  email?: string;
  room?: string;
  notes?: string;
  detentionAgency?: string;
  detentionNumber?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 3.3 API 설계

#### `GET /api/admin/cases/[id]/institutions`

- 사건의 전체 institution 배열 반환 (stage 순)

#### `PUT /api/admin/cases/[id]/institutions`

- body: `{ institutions: CaseInstitutionInput[], activeStage?: CaseInstitutionStage }`
- 트랜잭션: upsert by `(case_id, stage)`, 없는 stage는 삭제하지 않음 (명시적 null만 삭제 — **보수적 merge**)
- `activeStage` 있으면 `cases.active_stage`·`cases.court` 갱신

#### 사건 생성 `POST /api/admin/cases` 확장 (선택)

- body에 `institutions` 배열 허용 → insert 후 일괄 insert

**신규 파일**

```
src/app/api/admin/cases/[id]/institutions/route.ts
src/lib/caseInstitutionApi.ts   -- row ↔ type, upsert 로직
```

---

## 4. Sprint 3 — Phase B-2: 사건등록 UI 와이어

### 4.1 페이지 구조 (LawTop 3섹션)

```
/cases/new
/cases/[id]/edit
└── CaseFormShell (공통)
    ├── Section 1: 기초사항 (CaseBasicSection)      — 기존 FormSection 확장
    ├── Section 2: 계속기관 (CaseInstitutionSection) — 신규
    └── Section 3: 당사자 (CasePartySection)         — Sprint 5 전까지 기존 유지
```

### 4.2 Section 1 — 기초사항 필드

| 필드 | 필수 | 비고 |
|------|------|------|
| 사건번호 (대표) | ✓ | 최신 심급 번호 권장 |
| 사건종류 | ✓ | |
| 사건명 | ✓ | |
| 심급 | | 1심/2심/3심/기타 → `trial_level` |
| 관리키 | | LawTop 키값 |
| 수임일 | ✓ | |
| 담당 변호사·보조 | ✓ | StaffMultiPicker |
| 전자사건 | | |
| 재판부·기관연락처 | | `court_division` (현재 심급 요약용) |
| 비고 | | |

**제거·이동**

- 단일 「기관」필수 → **계속기관 탭의 active stage**로 대체 (이행 기간: 기관 필드 유지 + 자동 채움)

### 4.3 Section 2 — 계속기관 (핵심)

#### 데스크톱 (≥1024px)

```
┌─────────────────────────────────────────────────────────┐
│ [경찰] [검찰] [1심] [2심] [3심] [구금]     ← SegmentedTabs │
├─────────────────────────────────────────────────────────┤
│ 기관명          [________________]                       │
│ 사건번호        [________________]                       │
│ 사건명          [________________]                       │
│ 담당부서        [________]  담당자 [________]            │
│ 전화            [________]  휴대   [________]            │
│ 팩스            [________]  이메일 [________]            │
│ 호실            [________]  [지도] (2차: 링크만)          │
│ ── 구금 (detention 탭 또는 하위) ──                      │
│ 구금기관        [________]  구금번호 [________]           │
│ 메모            [________________________]               │
│                              [이 단계를 현재 진행으로 표시] │
└─────────────────────────────────────────────────────────┘
```

- 탭 전환 시 **미저장 변경** 있으면 confirm
- 「현재 진행으로 표시」→ `active_stage` + `cases.court` 동기화

#### 모바일 (<1024px)

`useIsMobile()` 기준:

1. **세그먼트를 가로 스크롤 chips** (`FilterTray` 패턴 재사용)
2. 필드는 **1열 스택** (`grid-cols-1`)
3. 선택 단계 요약 카드: 사건 목록·상세에서  
   `경찰 · 안산경찰서 · 010-...` 한 줄

**신규 컴포넌트**

```
src/components/cases/CaseInstitutionSection.tsx
src/components/cases/CaseInstitutionStageTabs.tsx
src/components/cases/CaseInstitutionForm.tsx
src/components/cases/CaseFormShell.tsx
```

### 4.4 사건 상세 (`/cases/[id]`) 반영

좌측 패널 **Case details** 블록 아래 추가:

```
계속기관
  [경찰][검찰][1심]...  ← active 강조
  기관: 안산지청
  사건번호: 2025형제32065
  담당: 형사3부 / 양종화 검사
  전화: 031-xxx (탭하면 tel:)
  [수정] → edit 페이지 해당 탭으로 deep link (?section=institution&stage=prosecution)
```

모바일: `MobileBottomSheet`로 「계속기관 연락처」빠른 조회.

### 4.5 검증 규칙

| 규칙 | 내용 |
|------|------|
| 최소 1단계 | 등록 시 `active_stage`에 해당하는 institution에 `agency_name` 필수 |
| 전화 형식 | 선택, 저장 시 trim만 (기존 deadlineDisplay와 동일) |
| 중복 stage | 클라이언트에서 탭 1개 = 객체 1개 |

---

## 5. Sprint 4 — LawTop 엑셀 1:1 매핑표

### 5.1 datacase / chung.xlsx 주요 컬럼

| LawTop 엑셀 헤더 | LawyGo 필드 | 테이블·컬럼 | 비고 |
|------------------|-------------|-------------|------|
| 키값 | managementKey | `cases.management_key` | Sprint 1 |
| 사건번호 | caseNumber | `cases.case_number` | 대표 번호 |
| 소분류 / 사건종류 | caseType | `cases.case_type` | `inferCaseType` |
| 사건명 | caseName | `cases.case_name` | |
| 계속기관 | court | `cases.court` | active stage agency |
| 계속부서 | courtDivision | `cases.court_division` | Sprint 1 분리 저장 |
| 의뢰인 | clientName | `cases.client_name` + `clients` | upsert |
| 의)지위 | clientPosition | `cases.client_position` | |
| 상대방 | opponentName | `cases.opponent_name` | Phase C에서 parties |
| 수행변호사 | assignedStaff | `cases.assigned_staff_name` | |
| 보조 | assistants | `cases.assistants` | |
| 수임일 | receivedDate | `cases.received_date` | |
| 전자 / 전자소송 | isElectronic | `cases.is_electronic` | |
| 비고 | notes | `cases.notes` | |
| 진행/잔여일 | nextHearingDate | `deadlines` | 기존 로직 |
| 기일명 | nextHearingType | `deadlines` | |

### 5.2 LawTop DB 전용 (엑셀에 없을 수 있음) → `case_institutions`

| LawTop UI (계속기관 탭) | stage | 컬럼 |
|-------------------------|-------|------|
| 수사기관(경찰) | `police` | agency_name, case_number, phone, ... |
| 수사기관(검찰) | `prosecution` | 동일 |
| 법원 (심급별) | `court_1` / `court_2` / `court_3` | `cases.trial_level`로 초기 탭 추론 |
| 구금 | `detention` | detention_agency, detention_number |

**초기 import 전략 (엑셀만 있을 때)**

1. `계속기관` + `계속부서` → `trial_level` 추론 후 해당 `court_*` institution 1행 생성
2. `court_division`에서 전화 regex 추출 → `phone` 필드 (`deadlineDisplay` PHONE_REGEX 재사용)
3. 검찰/경찰 정보 없음 → 빈 탭 (사용자가 상세에서 보완)

### 5.3 기존 데이터 이관 스크립트

```
scripts/migrate-notes-to-institutions.mjs
```

- `notes`에 `재판부:` 포함 건 → `court_division` backfill (미이전 시)
- regex로 전화 추출해 `case_institutions.court_1.phone` 후보 저장
- dry-run 모드 기본

---

## 6. Sprint 5 — Phase C: `case_parties`

### 6.1 테이블 초안

```sql
CREATE TYPE public.case_party_role AS ENUM ('client', 'opponent', 'third_party');

CREATE TABLE public.case_parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  role public.case_party_role NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  position TEXT,
  is_corporate BOOLEAN DEFAULT FALSE,
  phone TEXT,
  mobile TEXT,
  fax TEXT,
  email TEXT,
  address TEXT,
  id_number TEXT,
  biz_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_case_parties_case_id ON public.case_parties(case_id);
```

- `cases.client_name` = `role=client` & `sort_order=0` denormalized cache (목록 성능)
- UI: LawTop처럼 우측 의뢰인 목록 + 추가/제외

---

## 7. 파일 생성·수정 체크리스트

### 신규

| 경로 | Sprint |
|------|--------|
| `supabase/migrations/20260611000001_cases_trial_meta.sql` | 1 |
| `supabase/migrations/20260611000000_case_institutions.sql` | 2 |
| `src/lib/caseInstitutionTypes.ts` | 2 |
| `src/lib/caseInstitutionApi.ts` | 2 |
| `src/lib/caseClientSync.ts` | 1 |
| `src/app/api/admin/cases/[id]/institutions/route.ts` | 2 |
| `src/components/cases/CaseInstitutionSection.tsx` | 3 |
| `src/components/cases/CaseInstitutionStageTabs.tsx` | 3 |
| `src/components/cases/CaseInstitutionForm.tsx` | 3 |
| `src/components/cases/CaseFormShell.tsx` | 3 |
| `scripts/migrate-notes-to-institutions.mjs` | 4 |
| `supabase/migrations/20260612000000_case_parties.sql` | 5 |

### 수정

| 경로 | Sprint |
|------|--------|
| `src/lib/types.ts` | 1, 2 |
| `src/lib/caseImportServer.ts` | 1, 4 |
| `src/lib/caseExcel.ts` | 1, 4 |
| `src/app/api/admin/cases/route.ts` | 1, 2 |
| `src/app/api/admin/cases/[id]/route.ts` | 1, 2 |
| `src/app/cases/new/page.tsx` | 1 → 3 (Shell로 교체) |
| `src/app/cases/[id]/edit/page.tsx` | 1 → 3 |
| `src/app/cases/[id]/page.tsx` | 1, 3 |

---

## 8. 수용 기준 (전체 완료 시)

1. 형사 사건 하나에 **경찰·검찰·1심** 연락처를 각각 저장하고 상세에서 탭 전환 조회 가능
2. 「현재 진행 단계」 지정 시 목록의 `court`·필터가 해당 기관으로 표시
3. 모바일에서 **한 손가락**으로 단계 chip 전환 + 전화 탭 연결
4. LawTop 엑셀 `계속부서`가 `court_division`에, 가능 시 institution에 구조화
5. 의뢰인 연락처가 `clients` DB와 `cases.client_id`로 연결

---

## 9. 리스크·완화

| 리스크 | 완화 |
|--------|------|
| `cases.court` 단일 필드와 다단계 데이터 불일치 | `active_stage` 기준 서버 동기화 + 목록에 「현재: 검찰」뱃지 |
| 기존 localStorage 의뢰인 | Sprint 1에서 API 우선, localStorage는 읽기 fallback |
| 엑셀에 경찰/검찰 분리 없음 | 빈 탭 두고 UI에서 수동 입력 유도 |
| RLS / service role | 기존 cases와 동일 정책, admin API는 service role |

---

## 10. 다음 액션 (바로 착수 가능)

**Sprint 1 첫 PR (추천 범위)**

1. `courtDivision` 타입·API·폼·상세 표시
2. `caseClientSync` + 등록 시 `client_id` 연결
3. `trial_level` / `management_key` 마이그레이션 + 폼 2필드

예상 diff: ~15파일, DB 마이그레이션 1개, **기능 플래그 없이** 바로 배포 가능.

원하면 이 Sprint 1부터 코드 구현을 진행한다.
