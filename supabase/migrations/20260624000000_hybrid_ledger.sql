-- 하이브리드 분산 원장 (HDL) — 신원-거래 강결합 + Merkle 블록 + 외부 앵커
-- @see docs/planning/hybrid-ledger-lawygo-spec.md

CREATE TABLE IF NOT EXISTS public.identity_verification_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  verification_result TEXT NOT NULL CHECK (verification_result = 'approved'),
  verified_at TIMESTAMPTZ NOT NULL,
  h_v TEXT NOT NULL,
  session_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_hashes_tenant_user
  ON public.identity_verification_hashes(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_identity_hashes_h_v ON public.identity_verification_hashes(h_v);

CREATE TABLE IF NOT EXISTS public.ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id UUID,
  trans_data JSONB NOT NULL,
  h_v_id UUID NOT NULL REFERENCES public.identity_verification_hashes(id),
  prev_hash TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'chained', 'block_assigned', 'tampered')),
  block_id UUID,
  seq BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_tx_tenant_stream_status
  ON public.ledger_transactions(tenant_id, stream, status, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_block ON public.ledger_transactions(block_id);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_source ON public.ledger_transactions(source_table, source_id);

CREATE TABLE IF NOT EXISTS public.ledger_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  stream TEXT NOT NULL,
  block_height BIGINT NOT NULL,
  prev_block_hash TEXT,
  merkle_root TEXT NOT NULL,
  block_hash TEXT NOT NULL,
  tx_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, stream, block_height)
);

CREATE INDEX IF NOT EXISTS idx_ledger_blocks_tenant_stream
  ON public.ledger_blocks(tenant_id, stream, block_height DESC);

CREATE TABLE IF NOT EXISTS public.ledger_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES public.ledger_blocks(id) ON DELETE CASCADE,
  merkle_root TEXT NOT NULL,
  anchor_hash TEXT NOT NULL,
  external_network TEXT NOT NULL DEFAULT 'lawygo_timestamp_v1',
  external_block_height BIGINT,
  external_tx_id TEXT,
  anchor_proof JSONB DEFAULT '{}'::jsonb,
  anchored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_anchors_block ON public.ledger_anchors(block_id);

CREATE TABLE IF NOT EXISTS public.ledger_integrity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  tamper_point_tx_id UUID REFERENCES public.ledger_transactions(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  replay_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (replay_status IN ('pending', 'running', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ledger_alerts_tenant ON public.ledger_integrity_alerts(tenant_id, created_at DESC);

-- 기존 감사 테이블 ↔ 원장 연결
ALTER TABLE public.case_audit_logs ADD COLUMN IF NOT EXISTS ledger_tx_id UUID;
ALTER TABLE public.approval_actions ADD COLUMN IF NOT EXISTS ledger_tx_id UUID;
ALTER TABLE public.user_admin_audit_logs ADD COLUMN IF NOT EXISTS ledger_tx_id UUID;
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS ledger_tx_id UUID;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS agreement_hash TEXT;

-- Append-only: UPDATE/DELETE 차단 (service_role worker는 SECURITY DEFINER 함수로 우회)
CREATE OR REPLACE FUNCTION public.ledger_prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ledger append-only: % on % is not allowed', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_identity_hashes_no_update ON public.identity_verification_hashes;
CREATE TRIGGER trg_identity_hashes_no_update
  BEFORE UPDATE OR DELETE ON public.identity_verification_hashes
  FOR EACH ROW EXECUTE FUNCTION public.ledger_prevent_mutation();

DROP TRIGGER IF EXISTS trg_ledger_tx_no_delete ON public.ledger_transactions;
CREATE TRIGGER trg_ledger_tx_no_delete
  BEFORE DELETE ON public.ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION public.ledger_prevent_mutation();

DROP TRIGGER IF EXISTS trg_ledger_blocks_no_update ON public.ledger_blocks;
CREATE TRIGGER trg_ledger_blocks_no_update
  BEFORE UPDATE OR DELETE ON public.ledger_blocks
  FOR EACH ROW EXECUTE FUNCTION public.ledger_prevent_mutation();

DROP TRIGGER IF EXISTS trg_ledger_anchors_no_update ON public.ledger_anchors;
CREATE TRIGGER trg_ledger_anchors_no_update
  BEFORE UPDATE OR DELETE ON public.ledger_anchors
  FOR EACH ROW EXECUTE FUNCTION public.ledger_prevent_mutation();

-- Worker 전용: pending → chained 상태 전이
CREATE OR REPLACE FUNCTION public.ledger_chain_transaction(
  p_tx_id UUID,
  p_prev_hash TEXT,
  p_tx_hash TEXT,
  p_seq BIGINT
) RETURNS VOID AS $$
BEGIN
  UPDATE public.ledger_transactions
  SET prev_hash = p_prev_hash,
      tx_hash = p_tx_hash,
      status = 'chained',
      seq = p_seq
  WHERE id = p_tx_id AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.ledger_assign_block(
  p_tx_ids UUID[],
  p_block_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE public.ledger_transactions
  SET block_id = p_block_id, status = 'block_assigned'
  WHERE id = ANY(p_tx_ids) AND status = 'chained';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.identity_verification_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_integrity_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_identity_service" ON public.identity_verification_hashes;
CREATE POLICY "ledger_identity_service" ON public.identity_verification_hashes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ledger_tx_service" ON public.ledger_transactions;
CREATE POLICY "ledger_tx_service" ON public.ledger_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ledger_blocks_service" ON public.ledger_blocks;
CREATE POLICY "ledger_blocks_service" ON public.ledger_blocks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ledger_anchors_service" ON public.ledger_anchors;
CREATE POLICY "ledger_anchors_service" ON public.ledger_anchors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ledger_alerts_service" ON public.ledger_integrity_alerts;
CREATE POLICY "ledger_alerts_service" ON public.ledger_integrity_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ledger_tx_admin_read" ON public.ledger_transactions;
CREATE POLICY "ledger_tx_admin_read" ON public.ledger_transactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ledger_blocks_admin_read" ON public.ledger_blocks;
CREATE POLICY "ledger_blocks_admin_read" ON public.ledger_blocks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ledger_anchors_admin_read" ON public.ledger_anchors;
CREATE POLICY "ledger_anchors_admin_read" ON public.ledger_anchors
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ledger_alerts_admin_read" ON public.ledger_integrity_alerts;
CREATE POLICY "ledger_alerts_admin_read" ON public.ledger_integrity_alerts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ledger_identity_admin_read" ON public.identity_verification_hashes;
CREATE POLICY "ledger_identity_admin_read" ON public.identity_verification_hashes
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.identity_verification_hashes IS 'HDL 신원 확인 해시 H_v (append-only)';
COMMENT ON TABLE public.ledger_transactions IS 'HDL 거래 원장 — H_i 해시 체인';
COMMENT ON TABLE public.ledger_blocks IS 'HDL Merkle 블록';
COMMENT ON TABLE public.ledger_anchors IS 'HDL 외부 앵커 (타임스탬프/L2)';
COMMENT ON TABLE public.ledger_integrity_alerts IS 'HDL 무결성 알림·변조 지점';
