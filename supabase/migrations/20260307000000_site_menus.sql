-- 프론트엔드 메뉴 관리 (관리자 페이지에서 등록/편집/삭제)
CREATE TABLE IF NOT EXISTS public.site_menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('lnb', 'mobile_main', 'mobile_more')),
  item_order INT NOT NULL DEFAULT 0,
  item_id TEXT NOT NULL,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  icon TEXT NOT NULL,
  badge INT,
  roles TEXT[] DEFAULT '{}',
  lawtop_module TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_site_menus_type ON public.site_menus(type);
CREATE INDEX IF NOT EXISTS idx_site_menus_order ON public.site_menus(type, item_order);

COMMENT ON TABLE public.site_menus IS '법무관리시스템 프론트엔드 메뉴 - LNB/모바일 등';

ALTER TABLE public.site_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_menus_select" ON public.site_menus FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "site_menus_all_admin" ON public.site_menus FOR ALL TO authenticated USING (true);

CREATE TRIGGER site_menus_updated_at BEFORE UPDATE ON public.site_menus FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
