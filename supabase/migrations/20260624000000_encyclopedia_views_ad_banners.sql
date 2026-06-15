-- 로이고법률백과 문서 조회수 + 배너광고

CREATE TABLE IF NOT EXISTS public.legal_document_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  management_number TEXT NOT NULL,
  document_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  vector_id UUID REFERENCES public.legal_vectors(id) ON DELETE SET NULL,
  view_count INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (management_number, document_key)
);

CREATE INDEX IF NOT EXISTS idx_legal_document_stats_views
  ON public.legal_document_stats (management_number, view_count DESC);
CREATE INDEX IF NOT EXISTS idx_legal_document_stats_key
  ON public.legal_document_stats (document_key);

COMMENT ON TABLE public.legal_document_stats IS '법률백과 문서별 회원 조회수 집계';

CREATE TABLE IF NOT EXISTS public.site_ad_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  management_number TEXT,
  placement TEXT NOT NULL DEFAULT 'legal_encyclopedia',
  item_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_ad_banners_placement
  ON public.site_ad_banners (placement, item_order);
CREATE INDEX IF NOT EXISTS idx_site_ad_banners_mgmt
  ON public.site_ad_banners (management_number);

COMMENT ON TABLE public.site_ad_banners IS '사이트 배너광고 (관리자 WYSIWYG 관리)';

ALTER TABLE public.legal_document_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_ad_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_document_stats_service ON public.legal_document_stats;
CREATE POLICY legal_document_stats_service ON public.legal_document_stats FOR ALL USING (false);

DROP POLICY IF EXISTS site_ad_banners_service ON public.site_ad_banners;
CREATE POLICY site_ad_banners_service ON public.site_ad_banners FOR ALL USING (false);
