-- Google OAuth 컬럼 + 가입심사 상태(보류·거절)

ALTER TABLE public.site_users
  ADD COLUMN IF NOT EXISTS google_id text,
  ADD COLUMN IF NOT EXISTS google_email text,
  ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'local';

CREATE UNIQUE INDEX IF NOT EXISTS site_users_google_id_key ON public.site_users (google_id) WHERE google_id IS NOT NULL;

ALTER TABLE public.site_users DROP CONSTRAINT IF EXISTS site_users_status_check;

ALTER TABLE public.site_users
  ADD CONSTRAINT site_users_status_check
  CHECK (status IN ('pending', 'active', 'approved', 'on_hold', 'rejected', 'resigned', 'excluded'));

COMMENT ON COLUMN public.site_users.google_id IS 'Google OAuth sub (고유 ID)';
COMMENT ON COLUMN public.site_users.google_email IS 'Google 계정 이메일';
COMMENT ON COLUMN public.site_users.auth_provider IS 'local | google';
