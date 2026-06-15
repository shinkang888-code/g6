-- 회사(관리번호)별 SaaS 구독 — Stripe / Danal 월결제

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  management_number text PRIMARY KEY REFERENCES company_groups(management_number) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'trialing',
  plan_id text NOT NULL DEFAULT 'standard_monthly',
  billing_provider text,
  stripe_customer_id text,
  stripe_subscription_id text,
  danal_user_id text,
  danal_bill_key text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  trial_ends_at timestamptz,
  suspended_at timestamptz,
  cancelled_at timestamptz,
  seat_limit int NOT NULL DEFAULT 50,
  last_payment_at timestamptz,
  last_payment_amount int,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tenant_subscriptions IS '관리번호별 LawyGo SaaS 구독 상태';
COMMENT ON COLUMN tenant_subscriptions.status IS 'trialing|active|past_due|suspended|cancelled';
COMMENT ON COLUMN tenant_subscriptions.billing_provider IS 'stripe|danal|manual';

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status ON tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_period_end ON tenant_subscriptions(current_period_end);

CREATE TABLE IF NOT EXISTS subscription_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  management_number text NOT NULL,
  provider text NOT NULL,
  event_type text NOT NULL,
  amount int,
  currency text NOT NULL DEFAULT 'krw',
  external_id text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subscription_payment_events IS '구독 결제·웹훅 이벤트 로그';

CREATE INDEX IF NOT EXISTS idx_subscription_payment_events_mn ON subscription_payment_events(management_number);
CREATE INDEX IF NOT EXISTS idx_subscription_payment_events_created ON subscription_payment_events(created_at DESC);

-- 기존 회사: 체험/플랫폼은 active, 나머지는 14일 trial
INSERT INTO tenant_subscriptions (management_number, status, trial_ends_at, current_period_end, billing_provider)
SELECT
  cg.management_number,
  CASE
    WHEN cg.management_number IN ('00000', '10000') THEN 'active'
    ELSE 'trialing'
  END,
  CASE
    WHEN cg.management_number IN ('00000', '10000') THEN NULL
    ELSE now() + interval '14 days'
  END,
  CASE
    WHEN cg.management_number IN ('00000', '10000') THEN now() + interval '10 years'
    ELSE now() + interval '14 days'
  END,
  CASE
    WHEN cg.management_number IN ('00000', '10000') THEN 'manual'
    ELSE NULL
  END
FROM company_groups cg
ON CONFLICT (management_number) DO NOTHING;

ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_subscriptions_deny_all ON tenant_subscriptions;
CREATE POLICY tenant_subscriptions_deny_all ON tenant_subscriptions FOR ALL USING (false);

DROP POLICY IF EXISTS subscription_payment_events_deny_all ON subscription_payment_events;
CREATE POLICY subscription_payment_events_deny_all ON subscription_payment_events FOR ALL USING (false);
