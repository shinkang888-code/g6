/**
 * shinkang 전체관리자(platform_admin) 계정 설정
 * node scripts/setup-platform-admin.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import path from "path";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const db = createClient(url, key);

const { data, error } = await db
  .from("site_users")
  .update({
    management_number: "00000",
    role: "관리자",
    permission_role_id: "platform_admin",
    name: "전체관리자",
    status: "approved",
  })
  .eq("login_id", "shinkang")
  .select("id, login_id, management_number, permission_role_id")
  .maybeSingle();

if (error) {
  console.error("FAIL:", error.message);
  process.exit(1);
}
if (!data) {
  console.error("shinkang 계정이 없습니다. seed-admin.mjs 먼저 실행하세요.");
  process.exit(1);
}

console.log("OK: shinkang 전체관리자 설정");
console.log(" ", data);

// company_groups 확인
for (const mn of ["00000", "10000"]) {
  await db.from("company_groups").upsert(
    {
      management_number: mn,
      group_name: mn === "10000" ? "체험판 법무법인" : "법무법인 00000",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "management_number" }
  );
}
console.log("OK: company_groups 00000, 10000");
