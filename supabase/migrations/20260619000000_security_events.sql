-- Enterprise_Log_Monitoring SecurityLog → LawyGo security_events
-- @see https://github.com/Yoogimin/Enterprise_Log_Monitoring

CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  attack_type TEXT NOT NULL,
  severity_level TEXT NOT NULL CHECK (severity_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  status TEXT NOT NULL DEFAULT 'MONITORED' CHECK (status IN ('MONITORED', 'WARNING', 'BLOCKED', 'RESOLVED')),
  source TEXT NOT NULL DEFAULT 'api' CHECK (source IN ('api', 'auth', 'upload', 'ai', 'admin', 'rule', 'scan')),
  route_path TEXT,
  actor_login_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_detected_at ON public.security_events(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity_level);
CREATE INDEX IF NOT EXISTS idx_security_events_attack_type ON public.security_events(attack_type);
CREATE INDEX IF NOT EXISTS idx_security_events_status ON public.security_events(status);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON public.security_events(ip_address);

COMMENT ON TABLE public.security_events IS '보안 위협·이상 행위 관제 로그 (Enterprise_Log_Monitoring SecurityLog 이식)';

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "security_events_service_all" ON public.security_events;
CREATE POLICY "security_events_service_all"
  ON public.security_events FOR ALL TO service_role USING (true) WITH CHECK (true);
