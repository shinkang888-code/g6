# 기일(deadlines) 테이블 설정

기일 엑셀 업로드 시 **"Could not find the table 'public.deadlines'"** 오류가 나면, Supabase에 `public.deadlines` 테이블이 없는 상태입니다.

## 1. 테이블 생성 (한 번만 실행)

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택
2. **SQL Editor** 메뉴 이동
3. **New query** 클릭 후 아래 SQL 전체 복사·붙여넣기 후 **Run** 실행

```sql
-- 기일 엑셀 업로드 오류 해결용
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.deadlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  deadline_date DATE NOT NULL,
  deadline_type TEXT NOT NULL,
  court TEXT,
  memo TEXT,
  is_immutable BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deadlines_case_id ON public.deadlines(case_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_date ON public.deadlines(deadline_date);

ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deadlines_all" ON public.deadlines;
CREATE POLICY "deadlines_all" ON public.deadlines FOR ALL TO authenticated USING (true);
```

또는 프로젝트 루트에서 마이그레이션 파일 내용을 그대로 실행해도 됩니다.

- 파일 경로: `supabase/migrations/20260310110000_ensure_deadlines_table.sql`

## 2. datelist.xls 실데이터로 채우기 (더미 삭제 후 반영)

테이블을 만든 뒤 다음 중 하나로 기일 데이터를 넣으면 됩니다.

### 방법 A: 웹에서 업로드
**달력 → 기일 엑셀 업로드** 또는 **기일관리** 화면에서 `datelist.xls`를 선택 후 **업로드 후 DB 반영** 클릭.  
(기존 기일은 전부 삭제된 뒤, 엑셀 내용만 DB에 반영됩니다.)

### 방법 B: 로컬 시드 스크립트
프로젝트 루트에서:

```bash
npm run seed-deadlines-excel "c:\Users\user\OneDrive\문서\카카오톡 받은 파일\lawygo\datelist.xls"
```

또는:

```bash
node scripts/seed-deadlines-from-excel.mjs "c:\Users\user\OneDrive\문서\카카오톡 받은 파일\lawygo\datelist.xls"
```

- `public.cases`에 있는 **사건번호**와 엑셀 **사건번호**가 일치하는 행만 기일로 등록됩니다.
- 기존 기일은 전부 삭제된 뒤, 엑셀 내용으로 다시 채워집니다.
