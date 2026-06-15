-- LawTop GL 스타일 사내 메신저·전자결재 스키마 확장
-- internal_messages, approval_actions + approvals/notifications 컬럼 보강

-- approvals: site_users.id 기반 requester, JSON 결재선
ALTER TABLE public.approvals
  DROP CONSTRAINT IF EXISTS approvals_requester_id_fkey;

ALTER TABLE public.approvals
  ALTER COLUMN requester_id TYPE TEXT USING requester_id::text;

ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS requester_login_id TEXT,
  ADD COLUMN IF NOT EXISTS approval_line JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS referrer_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachment_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachment_data JSONB;

-- notifications: login_id 기반 수신 + 결재 연동
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE public.notifications
  ALTER COLUMN user_id TYPE TEXT USING user_id::text;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_login_id TEXT,
  ADD COLUMN IF NOT EXISTS approval_id UUID REFERENCES public.approvals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_login ON public.notifications(recipient_login_id);
CREATE INDEX IF NOT EXISTS idx_notifications_approval_id ON public.notifications(approval_id);

-- 사내 메신저 (LawTop MessageSend/Receive)
CREATE TABLE IF NOT EXISTS public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_login_id TEXT,
  body TEXT NOT NULL,
  attachment_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachment_data JSONB,
  thread_key TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_messages_sender ON public.internal_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_recipient ON public.internal_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_thread ON public.internal_messages(thread_key);
CREATE INDEX IF NOT EXISTS idx_internal_messages_created ON public.internal_messages(created_at DESC);

-- 결재 이력 (LawTop ProcessHistory)
CREATE TABLE IF NOT EXISTS public.approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submit', 'approve', 'reject', 'revert', 'comment')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_actions_approval ON public.approval_actions(approval_id);

ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal_messages_all" ON public.internal_messages;
CREATE POLICY "internal_messages_all" ON public.internal_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "approval_actions_all" ON public.approval_actions;
CREATE POLICY "approval_actions_all" ON public.approval_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.internal_messages IS '사내 메신저 (LawTop MessageSend/Receive)';
COMMENT ON TABLE public.approval_actions IS '전자결재 이력 (LawTop ProcessHistory)';
