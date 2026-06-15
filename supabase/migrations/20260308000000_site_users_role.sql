-- site_users에 직급(role) 추가 - 로그인 회원 = 직원 연동용
ALTER TABLE public.site_users
  ADD COLUMN IF NOT EXISTS role TEXT;

COMMENT ON COLUMN public.site_users.role IS '직급 (임원, 변호사, 사무장, 국장, 직원 등)';
