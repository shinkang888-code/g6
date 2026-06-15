/**
 * Supabase 클라이언트 (싱글톤)
 * - LawyGo DB 스키마: supabase/migrations/20260306000000_lawgo_schema.sql
 * - LawTop GL 구버전은 별도 DB 사용; 마이그레이션 시 스키마 매핑 참고 (docs/LAWTOP_GL_ANALYSIS.md)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as ReturnType<typeof createClient> | null);

/** 서버/Admin용 (Service Role) - API Route 등에서만 사용 */
export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !supabaseUrl) return null;
  return createClient(supabaseUrl, key);
}
