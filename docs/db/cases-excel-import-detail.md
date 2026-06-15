# 사건 엑셀 등록·DB 연동 상세 설명

관리자 > 사건관리에서 **대량 엑셀 등록**이 동작하도록 한 수정 사항을 파일·함수 단위로 자세히 정리한 문서입니다.

---

## 1. API: `src/app/api/admin/cases/route.ts`

엑셀에서 넘어온 **날짜(Excel 시리얼)** 와 **전자소송/긴급/기일고정(Y·예·1 등)** 을 DB에 넣기 전에 올바른 형식으로 변환하는 로직이 추가되었습니다.

### 1.1 `toBool(v: unknown): boolean`

**역할:** 엑셀/JSON에서 들어온 값을 `true`/`false`로 통일합니다.

**처리 순서:**

| 입력 타입/값 | 결과 |
|-------------|------|
| `undefined`, `null` | `false` |
| `boolean` | 그대로 반환 |
| `number` | `0`이면 `false`, 그 외 `true` |
| 문자열 | 공백 제거 후 대문자로 바꾼 뒤, 아래와 같으면 `true` |

**`true`로 인정하는 문자열:**  
`"Y"`, `"YES"`, `"O"`, `"1"`, `"TRUE"`, `"예"`  
(그 외는 모두 `false`)

**코드 위치:** 13~18행

```ts
function toBool(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toUpperCase();
  return s === "Y" || s === "YES" || s === "O" || s === "1" || s === "TRUE" || s === "예";
}
```

**사용처:**  
`toRow()` 안에서 `is_electronic`, `is_urgent`, `is_immutable_deadline`을 넣을 때 사용합니다.  
엑셀에 "Y", "예", "1", "O" 등으로 적어도 DB에는 `true`/`false`로 저장됩니다.

---

### 1.2 `toDateString(v: unknown): string`

**역할:** 엑셀에서 오는 **날짜 값**(문자열 또는 Excel 시리얼 숫자)을 **`YYYY-MM-DD`** 문자열로 바꿉니다.  
DB의 `received_date`(DATE 타입)에 그대로 넣을 수 있는 형식입니다.

**처리 규칙:**

| 입력 | 동작 |
|------|------|
| `undefined` / `null` | 오늘 날짜 `YYYY-MM-DD` |
| **숫자** (Excel 시리얼, 예: 44927) | 1900년 1월 1일 기준 일수로 해석 후 `YYYY-MM-DD`로 변환 |
| **문자열** (길이 ≥ 10) | 앞 10자만 사용 (예: `"2024-03-09"`, `"2024/03/09"`) |
| 그 외 | 오늘 날짜 `YYYY-MM-DD` |

**Excel 시리얼 날짜란?**  
Excel은 날짜를 "1900-01-01을 1로 하는 일수"로 저장합니다.  
예: `44927` → 2023년 1월 15일 근처.  
JavaScript에서는 `(일수 - 25569) * 86400 * 1000` 밀리초로 변환해 `Date` 객체를 만들 수 있습니다.  
(25569는 1970-01-01의 Excel 시리얼, 86400은 하루 초.)

**코드 위치:** 20~28행

```ts
function toDateString(v: unknown): string {
  if (v === undefined || v === null) return new Date().toISOString().slice(0, 10);
  if (typeof v === "number" && v > 10000) {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (s.length >= 10) return s.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}
```

**사용처:**  
`toRow()` 안에서 `received_date`(수임일)를 만들 때 사용합니다.  
엑셀에서 수임일이 숫자(시리얼)로 들어와도 DB에는 `YYYY-MM-DD`로 저장됩니다.

---

### 1.3 `toRow(item)` 에서의 적용

**`received_date` (수임일):**

- `item.receivedDate` 또는 `item.received_date`를 `toDateString()`에 넘깁니다.
- 엑셀에서 숫자(시리얼) 또는 문자열로 들어와도 최종적으로 `YYYY-MM-DD` 문자열로 DB에 들어갑니다.

**전자소송 / 긴급 / 기일고정:**

- `is_electronic` ← `toBool(item.isElectronic ?? item.is_electronic)`
- `is_urgent`     ← `toBool(item.isUrgent ?? item.is_urgent)`
- `is_immutable_deadline` ← `toBool(item.isImmutable ?? item.is_immutable_deadline)`

프론트에서 camelCase(`isElectronic`, `isUrgent`, `isImmutable`) 또는 snake_case로 보내도 모두 위에서 처리됩니다.

**정리:**  
API는 "엑셀 → JSON" 단계에서 이미 변환된 값만 받고, 여기서 한 번 더 **날짜는 YYYY-MM-DD**, **플래그는 boolean**으로 정규화해 DB에 넣습니다.  
그래서 엑셀에 "Y"/"예"/"1" 또는 날짜 숫자를 넣어도 DB에는 올바르게 저장됩니다.

---

## 2. 관리자 사건관리 페이지: `src/app/admin/cases/page.tsx`

엑셀 **헤더 이름**을 우리가 쓰는 **필드명(camelCase)** 으로 매핑하고, **전자소송/긴급/기일고정**을 boolean으로 바꾼 뒤 API로 보내는 부분이 추가·확장되었습니다.

### 2.1 `EXCEL_COLUMN_MAP` 확장 (전자소송, 긴급, 기일고정)

**역할:**  
엑셀 **첫 행(헤더)** 의 셀 값과 우리 앱의 **필드명**을 1:1로 매핑합니다.  
엑셀에 "전자소송", "긴급", "기일고정" 같은 한글 헤더가 있어도 인식해서 API가 기대하는 키로 바꿉니다.

**추가된 매핑 (93~99행 부근):**

| 엑셀 헤더(또는 영문) | 매핑되는 필드명 (API/프론트에서 사용) |
|---------------------|----------------------------------------|
| 전자소송            | `isElectronic`                         |
| 긴급                | `isUrgent`                             |
| 기일고정            | `isImmutable`                         |
| is_electronic       | `isElectronic`                         |
| is_urgent           | `isUrgent`                             |
| is_immutable_deadline | `isImmutable`                        |

**동작 흐름:**

1. `parseExcelToCases()`가 엑셀 첫 행을 `headers`로 읽습니다.
2. 각 데이터 행에서 `headers[j]`로 컬럼 이름을 찾고, `EXCEL_COLUMN_MAP[headers[j]]`로 위 필드명으로 바꿉니다.
3. "전자소송", "긴급", "기일고정" 열이 있으면 각각 `isElectronic`, `isUrgent`, `isImmutable` 키로 객체에 들어갑니다.
4. 이 객체들이 그대로 API `POST /api/admin/cases`의 `body.items`로 전달되고, API의 `toRow()`에서 다시 `toBool()`로 boolean 처리됩니다.

즉, **엑셀 컬럼 매핑 확장**은 "전자소송/긴급/기일고정 헤더를 인식해 DB 컬럼과 연결한다"는 의미입니다.

---

### 2.2 `toBool()` (프론트용)

**역할:**  
API와 동일하게, 엑셀에서 읽은 값(Y/예/1/O 등)을 boolean으로 바꿉니다.  
프론트에서는 **전자소송/긴급/기일고정** 세 필드에만 사용합니다.

**코드 위치:** 106~111행 부근

```ts
function toBool(v: string | number | boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toUpperCase();
  return s === "Y" || s === "YES" || s === "O" || s === "1" || s === "TRUE" || s === "예";
}
```

**사용처:**  
`parseExcelToCases()` 안에서, 한 행을 정규화한 뒤 다음 세 줄에서 사용합니다.

```ts
if (normalized.isElectronic !== undefined) normalized.isElectronic = toBool(normalized.isElectronic);
if (normalized.isUrgent !== undefined) normalized.isUrgent = toBool(normalized.isUrgent);
if (normalized.isImmutable !== undefined) normalized.isImmutable = toBool(normalized.isImmutable);
```

엑셀에 "Y", "예", "1" 등으로 적힌 값을 업로드 시점에 boolean으로 바꿔 두고, 그 객체를 API로 보냅니다.  
API에서도 한 번 더 `toBool()`을 타므로, 이중으로 정규화됩니다.

---

### 2.3 `parseExcelToCases()` 안의 정규화

**역할:**  
엑셀 시트를 읽어서 "사건 한 건 = 객체 하나" 배열로 만듭니다.  
그 과정에서:

- **헤더 → 필드명:** `EXCEL_COLUMN_MAP`으로 매핑 (위 2.1).
- **기본값:** `status` 없으면 `"진행중"`, `caseType` 없으면 `"민사"`.
- **전자소송/긴급/기일고정:** 값이 있으면 `toBool()`로 boolean 처리 (위 2.2).

**사건으로 인정하는 조건:**  
`caseNumber` 또는 `case_number` 또는 `"사건번호"` 키가 있고, 그 행에 유효한 값이 있어야 한 건으로 집계됩니다.  
그래서 "사건번호"가 비어 있는 행은 무시됩니다.

**정리:**  
관리자 페이지의 "엑셀 컬럼 매핑 확장"은  
(1) `EXCEL_COLUMN_MAP`에 전자소송/긴급/기일고정 추가  
(2) 파싱 후 해당 키가 있으면 `toBool()`로 boolean 변환  
이 두 가지로 구현되어 있습니다.

---

### 2.4 양식 다운로드 버튼

**역할:**  
사용자가 "업로드할 엑셀폼"을 바로 받을 수 있도록, **헤더만 있는 빈 엑셀**을 다운로드하는 버튼을 넣었습니다.

**구현:**

- **함수:** `@/lib/caseExcel`의 `downloadCaseExcelTemplate()` 사용.
- **버튼:** "사건 1건 등록" 옆에 **"양식 다운로드"** 버튼 추가, `FileDown` 아이콘 사용.
- **클릭 시:** `downloadCaseExcelTemplate()`이 호출되어 `사건등록_양식_YYYY-MM-DD.xlsx` 파일이 다운로드됩니다.

**헤더 순서/이름:**  
`caseExcel.ts`의 `CASE_EXCEL_HEADERS`와 동일합니다 (아래 3장).  
즉, "양식 다운로드"로 받은 엑셀에 데이터만 채워 넣으면 그대로 "대량사건엑셀등록"으로 업로드할 수 있습니다.

---

## 3. 사건 엑셀 라이브러리: `src/lib/caseExcel.ts`

**역할:**  
"사건 등록용 엑셀 양식"의 **헤더 정의**와 **양식 파일 다운로드**를 한 곳에서 관리합니다.  
관리자 페이지의 `EXCEL_COLUMN_MAP`과 맞춰 두어서, 양식으로 받은 엑셀을 그대로 업로드하면 인식됩니다.

### 3.1 `CASE_EXCEL_HEADERS`

**역할:**  
엑셀 **첫 행에 들어갈 헤더 문자열 배열**입니다.  
순서와 이름이 업로드 시 파싱 로직(`EXCEL_COLUMN_MAP`)과 맞아야 합니다.

**정의 (9~27행):**

```ts
export const CASE_EXCEL_HEADERS = [
  "사건번호",
  "사건종류",
  "사건명",
  "법원",
  "의뢰인",
  "지위",
  "상대방",
  "상태",
  "담당자",
  "보조",
  "수임일",
  "수임료",
  "수납액",
  "미수금",
  "전자소송",
  "긴급",
  "기일고정",
  "비고",
] as const;
```

**DB/API와의 대응:**

- 사건번호 → `case_number`
- 사건종류 → `case_type`
- 사건명 → `case_name`
- 법원 → `court`
- 의뢰인 → `client_name`
- 지위 → `client_position`
- 상대방 → `opponent_name`
- 상태 → `status`
- 담당자 → `assigned_staff_name`
- 보조 → `assistants`
- 수임일 → `received_date`
- 수임료 → `amount`
- 수납액 → `received_amount`
- 미수금 → `pending_amount`
- 전자소송 → `is_electronic`
- 긴급 → `is_urgent`
- 기일고정 → `is_immutable_deadline`
- 비고 → `notes`

즉, **위 양식과 동일한 헤더를 쓰는 `사건등록_양식_날짜.xlsx`** 가 곧 "업로드할 엑셀폼"입니다.

---

### 3.2 `downloadCaseExcelTemplate()`

**역할:**  
**헤더 한 행만 있는** 엑셀 시트를 만들어서, 파일로 저장(다운로드)합니다.

**동작 단계:**

1. **시트 데이터:** `[[...CASE_EXCEL_HEADERS]]` → 1행 N열의 2차원 배열 (헤더 한 줄).
2. **시트 생성:** `XLSX.utils.aoa_to_sheet(...)` 로 그 배열을 시트로 변환.
3. **통합 문서:** `XLSX.utils.book_new()` 로 새 통합 문서 생성.
4. **시트 붙이기:** `XLSX.utils.book_append_sheet(wb, ws, "사건목록")` → 시트 이름 "사건목록".
5. **파일 저장:** `XLSX.writeFile(wb, "사건등록_양식_YYYY-MM-DD.xlsx")` → 브라우저에서 해당 이름으로 다운로드.

**코드 (34~38행):**

```ts
export function downloadCaseExcelTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([[...CASE_EXCEL_HEADERS]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사건목록");
  XLSX.writeFile(wb, `사건등록_양식_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
```

**정리:**  
"양식 다운로드"는 이 함수를 호출해, **위와 동일한 헤더를 가진 사건등록_양식_날짜.xlsx** 를 생성·다운로드하는 것입니다.

---

## 4. 전체 데이터 흐름 요약

1. **양식 다운로드**  
   `downloadCaseExcelTemplate()` → `CASE_EXCEL_HEADERS`로 헤더만 있는 `사건등록_양식_날짜.xlsx` 생성.

2. **엑셀 작성**  
   사용자가 2행부터 사건 데이터 입력.  
   전자소송/긴급/기일고정에는 "Y", "예", "1", "O" 등 사용 가능.  
   수임일은 날짜 형식 또는 Excel이 저장한 숫자(시리얼) 모두 가능.

3. **업로드 (프론트)**  
   `parseExcelToCases(file)`  
   - 첫 행으로 헤더 읽기 → `EXCEL_COLUMN_MAP`으로 필드명 변환 (전자소송→isElectronic 등).  
   - 각 행을 객체로 만들고, 전자소송/긴급/기일고정이 있으면 `toBool()`로 boolean 처리.  
   - `fetch("/api/admin/cases", { method: "POST", body: JSON.stringify({ items }) })` 로 전송.

4. **API (서버)**  
   `toRow(item)`  
   - `received_date` → `toDateString()`으로 `YYYY-MM-DD` 보장 (Excel 시리얼 포함).  
   - `is_electronic`, `is_urgent`, `is_immutable_deadline` → `toBool()`로 boolean 보장.  
   - Supabase `cases` 테이블에 `insert`.

5. **DB**  
   `public.cases` 의  
   `received_date` (DATE),  
   `is_electronic`, `is_urgent`, `is_immutable_deadline` (BOOLEAN)  
   에 그대로 저장됩니다.  
   스키마는 기존 마이그레이션(`20260306000001_cases_standalone.sql`)과 동일하며, 전자소송/긴급/기일고정 컬럼은 이미 있어 추가 마이그레이션은 없습니다.

---

## 5. 요약 표

| 구분 | 파일 | 추가/변경 내용 |
|------|------|----------------|
| **API** | `src/app/api/admin/cases/route.ts` | `toBool()`, `toDateString()` 추가. `toRow()`에서 수임일은 `toDateString()`, 전자소송/긴급/기일고정은 `toBool()` 사용. |
| **관리자 페이지** | `src/app/admin/cases/page.tsx` | `EXCEL_COLUMN_MAP`에 전자소송·긴급·기일고정 매핑 추가. `toBool()` 추가. `parseExcelToCases()`에서 해당 필드 boolean 변환. `downloadCaseExcelTemplate` import 및 "양식 다운로드" 버튼 추가. |
| **엑셀 라이브러리** | `src/lib/caseExcel.ts` | `CASE_EXCEL_HEADERS` 정의, `downloadCaseExcelTemplate()`으로 헤더만 있는 `사건등록_양식_날짜.xlsx` 생성·다운로드. |
| **DB** | 마이그레이션 | 변경 없음. 기존 `cases` 테이블에 이미 `is_electronic`, `is_urgent`, `is_immutable_deadline` 존재. |

이 문서는 `docs/db/cases-excel-import-detail.md` 에 저장되어 있으며, 위 내용이 코드와 일치하도록 작성되었습니다.
