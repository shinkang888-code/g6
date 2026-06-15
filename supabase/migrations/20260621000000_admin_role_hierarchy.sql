-- 조직 관리 권한 계층 + 메신저 테넌트 격리

ALTER TABLE site_users
  ADD COLUMN IF NOT EXISTS is_company_founder BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN site_users.is_company_founder IS '관리번호별 첫 가입자(사내관리자) 여부';

ALTER TABLE internal_messages
  ADD COLUMN IF NOT EXISTS management_number TEXT;

CREATE INDEX IF NOT EXISTS idx_internal_messages_management_number
  ON internal_messages (management_number);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS management_number TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_management_number
  ON notifications (management_number);

-- 기존 메시지: 발신자 관리번호로 백필
UPDATE internal_messages im
SET management_number = su.management_number
FROM site_users su
WHERE im.management_number IS NULL
  AND im.sender_id IS NOT NULL
  AND su.id::text = im.sender_id::text;
