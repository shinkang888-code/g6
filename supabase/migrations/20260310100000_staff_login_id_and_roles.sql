-- staff 테이블: 회원 승인 시 직원으로 연동하기 위해 login_id 추가, role 허용 범위 확장

-- 1. login_id 컬럼 추가 (site_users.login_id와 1:1 매칭, 중복 방지)
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS login_id TEXT UNIQUE;
COMMENT ON COLUMN public.staff.login_id IS 'site_users.login_id 연동 - 승인 회원이 직원으로 자동 반영될 때 사용';

-- 2. role CHECK 확장 (회원 권한과 동일하게)
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('관리자', '임원', '변호사', '사무장', '국장', '직원', '사무원', '인턴'));

CREATE INDEX IF NOT EXISTS idx_staff_login_id ON public.staff(login_id) WHERE login_id IS NOT NULL;
