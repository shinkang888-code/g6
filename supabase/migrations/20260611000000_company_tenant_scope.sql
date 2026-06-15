-- LawTop 스타일: 관리번호(회사) 단위 데이터 격리

CREATE TABLE IF NOT EXISTS company_groups (
  management_number text PRIMARY KEY,
  group_name text NOT NULL DEFAULT '',
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE company_groups IS '관리번호(회사) 그룹 메타 — LawTop 관리번호';

ALTER TABLE cases ADD COLUMN IF NOT EXISTS management_number text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS management_number text;
ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS management_number text;

CREATE INDEX IF NOT EXISTS idx_cases_management_number ON cases(management_number);
CREATE INDEX IF NOT EXISTS idx_clients_management_number ON clients(management_number);
CREATE INDEX IF NOT EXISTS idx_deadlines_management_number ON deadlines(management_number);
CREATE INDEX IF NOT EXISTS idx_site_users_management_number ON site_users(management_number);

-- 기존 데이터: 기본 관리번호로 백필 (운영 시 scripts/backfill-tenant-scope.mjs 권장)
UPDATE cases SET management_number = COALESCE(NULLIF(trim(management_number), ''), '00000') WHERE management_number IS NULL OR trim(management_number) = '';
UPDATE clients SET management_number = COALESCE(NULLIF(trim(management_number), ''), '00000') WHERE management_number IS NULL OR trim(management_number) = '';
UPDATE deadlines d SET management_number = COALESCE(c.management_number, '00000')
FROM cases c WHERE d.case_id = c.id AND (d.management_number IS NULL OR trim(d.management_number) = '');
UPDATE deadlines SET management_number = '00000' WHERE management_number IS NULL OR trim(management_number) = '';

INSERT INTO company_groups (management_number, group_name)
SELECT DISTINCT management_number, '법무법인 ' || management_number
FROM site_users
WHERE management_number IS NOT NULL AND trim(management_number) <> ''
ON CONFLICT (management_number) DO NOTHING;
