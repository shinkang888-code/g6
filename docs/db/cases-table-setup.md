# public.cases 테이블 생성 (DB 연동 오류 해결)

**에러 메시지:** `Could not find the table 'public.cases' in the schema cache`

사건 관리(대량 엑셀 등록, 사건 목록) 기능을 쓰려면 Supabase에 `public.cases` 테이블이 있어야 합니다.

## 해결 방법

1. **Supabase 대시보드** 접속 → 프로젝트 선택
2. 왼쪽 메뉴에서 **SQL Editor** 클릭
3. **New query** 로 새 쿼리 창 열기
4. 아래 SQL 전체를 복사해 붙여넣기 후 **Run** 실행

```sql
-- public.cases 테이블 생성 ("Could not find the table 'public.cases'" 오류 해결)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('변호사', '사무장', '사무원', '인턴', '관리자')),
  department TEXT DEFAULT '',
  email TEXT,
  phone TEXT,
  approval_level INT DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  position TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number TEXT NOT NULL UNIQUE,
  case_type TEXT NOT NULL,
  case_name TEXT NOT NULL,
  court TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_position TEXT,
  opponent_name TEXT,
  status TEXT NOT NULL DEFAULT '진행중' CHECK (status IN ('진행중', '완료', '보류', '취하', '종결')),
  assigned_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  assigned_staff_name TEXT NOT NULL,
  assistants TEXT DEFAULT '',
  received_date DATE NOT NULL,
  amount NUMERIC(15,0) DEFAULT 0,
  received_amount NUMERIC(15,0) DEFAULT 0,
  pending_amount NUMERIC(15,0) DEFAULT 0,
  is_electronic BOOLEAN DEFAULT FALSE,
  is_urgent BOOLEAN DEFAULT FALSE,
  is_immutable_deadline BOOLEAN DEFAULT FALSE,
  notes TEXT,
  closed_at DATE,
  closed_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_case_number ON public.cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_client_name ON public.cases(client_name);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_staff ON public.cases(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_cases_received_date ON public.cases(received_date);

DROP TRIGGER IF EXISTS cases_updated_at ON public.cases;
CREATE TRIGGER cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.cases;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.cases;
DROP POLICY IF EXISTS "Allow update for authenticated" ON public.cases;
DROP POLICY IF EXISTS "Allow delete for authenticated" ON public.cases;
CREATE POLICY "Allow read for authenticated" ON public.cases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated" ON public.cases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON public.cases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete for authenticated" ON public.cases FOR DELETE TO authenticated USING (true);
```

5. 실행이 끝나면 **사건 관리 페이지를 새로고침**하세요.

- `staff` / `clients` 테이블이 이미 있으면 `CREATE TABLE IF NOT EXISTS` 때문에 건너뜁니다.
- `public.cases`만 없을 때는 위 스크립트에서 `cases` 관련 부분만 실행해도 됩니다(단, `public.staff`, `public.clients`, `set_updated_at` 함수는 있어야 함).
- **관리자 > 사건관리**의 목록 조회·대량 엑셀 등록·일괄 종결/삭제는 모두 이 `public.cases` 테이블을 사용합니다. 테이블이 없으면 "DB 연동 오류 - public.cases 테이블 없음"이 나오므로, 반드시 위 SQL을 한 번 실행하세요.

원본 마이그레이션 파일: `supabase/migrations/20260306000001_cases_standalone.sql`
