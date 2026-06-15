-- 로그인 연동 회원 (관리자 승인 후 정식 회원)
-- Supabase 대시보드 → SQL Editor에서 실행 가능

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.site_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  management_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_site_users_login_id ON public.site_users(login_id);
CREATE INDEX IF NOT EXISTS idx_site_users_status ON public.site_users(status);
CREATE INDEX IF NOT EXISTS idx_site_users_management_number ON public.site_users(management_number);

COMMENT ON TABLE public.site_users IS '로그인 회원 - 대기(pending) 후 관리자 승인 시 정식(approved)';

ALTER TABLE public.site_users ENABLE ROW LEVEL SECURITY;

-- API(서버)에서만 접근; anon/authenticated 직접 접근 차단
CREATE POLICY "site_users_service_only" ON public.site_users
  FOR ALL USING (false);
