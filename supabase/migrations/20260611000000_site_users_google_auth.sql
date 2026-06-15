-- Google OAuth 연동용 site_users 확장

ALTER TABLE site_users
  ADD COLUMN IF NOT EXISTS google_id text,
  ADD COLUMN IF NOT EXISTS google_email text,
  ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'local';

CREATE UNIQUE INDEX IF NOT EXISTS site_users_google_id_key ON site_users (google_id) WHERE google_id IS NOT NULL;

COMMENT ON COLUMN site_users.google_id IS 'Google OAuth sub (고유 ID)';
COMMENT ON COLUMN site_users.google_email IS 'Google 계정 이메일';
COMMENT ON COLUMN site_users.auth_provider IS 'local | google';
