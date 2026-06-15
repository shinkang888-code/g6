-- LawTop 스타일 사용자관리: lifecycle 상태·프로필·감사로그

ALTER TABLE public.site_users DROP CONSTRAINT IF EXISTS site_users_status_check;

ALTER TABLE public.site_users
  ADD CONSTRAINT site_users_status_check
  CHECK (status IN ('pending', 'active', 'approved', 'resigned', 'excluded'));

-- approved → active (기존 데이터 호환)
UPDATE public.site_users SET status = 'active' WHERE status = 'approved';

ALTER TABLE public.site_users
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS permission_role_id text,
  ADD COLUMN IF NOT EXISTS resigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS resigned_by text,
  ADD COLUMN IF NOT EXISTS resign_reason text;

COMMENT ON COLUMN public.site_users.profile IS 'LawTop 인사카드 확장 필드 (학력·자격·메모 등)';

CREATE TABLE IF NOT EXISTS public.user_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_login_id text NOT NULL,
  actor_login_id text NOT NULL,
  action text NOT NULL,
  summary text,
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_admin_audit_target ON public.user_admin_audit_logs (target_login_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_users_status ON public.site_users (status);
CREATE INDEX IF NOT EXISTS idx_site_users_department ON public.site_users (department);

CREATE TABLE IF NOT EXISTS public.user_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id text NOT NULL,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memos_login_id ON public.user_memos (login_id);
