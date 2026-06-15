-- 회사(관리번호) 하위 조직 폴더 + 구성원 소속

CREATE TABLE IF NOT EXISTS public.company_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  management_number TEXT NOT NULL REFERENCES public.company_groups(management_number) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.company_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_organizations_unique_root
  ON public.company_organizations(management_number, name) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_organizations_unique_child
  ON public.company_organizations(management_number, parent_id, name) WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_organizations_management
  ON public.company_organizations(management_number);
CREATE INDEX IF NOT EXISTS idx_company_organizations_parent
  ON public.company_organizations(parent_id);

COMMENT ON TABLE public.company_organizations IS '관리번호 하위 조직 폴더(부서·팀)';

ALTER TABLE public.site_users
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.company_organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_site_users_organization_id ON public.site_users(organization_id);

ALTER TABLE public.company_organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_organizations_service_all" ON public.company_organizations;
CREATE POLICY "company_organizations_service_all"
  ON public.company_organizations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 기본 조직 폴더: 기존 회사마다 '본사' 생성
INSERT INTO public.company_organizations (management_number, parent_id, name, sort_order)
SELECT cg.management_number, NULL::uuid, '본사', 0
FROM public.company_groups cg
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_organizations co
  WHERE co.management_number = cg.management_number AND co.parent_id IS NULL AND co.name = '본사'
);

-- 기존 department 텍스트 → 동일 이름 조직 폴더 생성 후 연결
INSERT INTO public.company_organizations (management_number, parent_id, name, sort_order)
SELECT DISTINCT su.management_number, NULL::uuid, trim(su.department), 10
FROM public.site_users su
WHERE su.management_number IS NOT NULL
  AND trim(su.management_number) <> ''
  AND su.department IS NOT NULL
  AND trim(su.department) <> ''
  AND trim(su.department) <> '본사'
  AND NOT EXISTS (
    SELECT 1 FROM public.company_organizations co
    WHERE co.management_number = su.management_number
      AND co.parent_id IS NULL
      AND co.name = trim(su.department)
  );

UPDATE public.site_users su
SET organization_id = co.id
FROM public.company_organizations co
WHERE su.organization_id IS NULL
  AND su.management_number = co.management_number
  AND co.parent_id IS NULL
  AND co.name = COALESCE(NULLIF(trim(su.department), ''), '본사');
