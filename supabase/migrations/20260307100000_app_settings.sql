-- 시스템 설정 키-값 저장 (관리자 페이지에서 편집)
-- Supabase 대시보드 → SQL Editor에서 이 파일 내용을 붙여넣고 Run 실행

-- updated_at 자동 갱신 함수 (다른 마이그레이션에 없을 수 있으므로 먼저 생성)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);

COMMENT ON TABLE public.app_settings IS '테마, 알림, DB·API 연동, 권한 등 시스템 설정';

DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "app_settings_all_admin" ON public.app_settings;
CREATE POLICY "app_settings_all_admin" ON public.app_settings FOR ALL TO authenticated USING (true);

