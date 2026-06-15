-- 사건 자료실 (Google Drive 연동 메타)
-- case_folders: 사건별 가상 폴더
-- case_files: Drive 파일 ID 또는 로컬(base64) 저장

CREATE TABLE IF NOT EXISTS public.case_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_folders_case_id ON public.case_folders(case_id);

CREATE TABLE IF NOT EXISTS public.case_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT DEFAULT 'application/octet-stream',
  folder_id UUID REFERENCES public.case_folders(id) ON DELETE SET NULL,
  drive_file_id TEXT,
  web_view_link TEXT,
  storage_mode TEXT NOT NULL DEFAULT 'drive' CHECK (storage_mode IN ('drive', 'local')),
  local_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_files_case_id ON public.case_files(case_id);
CREATE INDEX IF NOT EXISTS idx_case_files_folder_id ON public.case_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_case_files_drive_file_id ON public.case_files(drive_file_id);

DROP TRIGGER IF EXISTS case_files_updated_at ON public.case_files;
CREATE TRIGGER case_files_updated_at
  BEFORE UPDATE ON public.case_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_folders_all" ON public.case_folders;
CREATE POLICY "case_folders_all" ON public.case_folders FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "case_files_all" ON public.case_files;
CREATE POLICY "case_files_all" ON public.case_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.case_folders IS '사건별 자료실 가상 폴더';
COMMENT ON TABLE public.case_files IS '사건 자료실 파일 메타 (Drive 또는 로컬 fallback)';
