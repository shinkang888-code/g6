-- 공지사항 (업무 대시보드 ↔ 공지 게시판 공유)
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  num_id SERIAL UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT '관리자',
  view_count INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notices_deleted_at ON public.notices(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notices_updated_at ON public.notices(updated_at DESC);

COMMENT ON TABLE public.notices IS '사무소 공지 — 대시보드·게시판(notice) 공유';
