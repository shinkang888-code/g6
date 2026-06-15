import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFiles() {
  const out = {};
  for (const file of [".env.production.local", "bot/.env", ".env.local"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        const value = m[2].replace(/^["']|["']$/g, "").trim();
        if (value) out[m[1]] = value;
      }
    }
  }
  return { ...out, ...process.env };
}

const env = loadEnvFiles();
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const rootFolderId = process.argv[2]?.trim();
if (!rootFolderId) {
  console.error("사용: node scripts/set-drive-root-folder.mjs <folderId>");
  process.exit(1);
}

const { data: row } = await db.from("app_settings").select("value").eq("key", "drive_settings").maybeSingle();
const value = { ...(row?.value ?? {}), rootFolderId, enabled: true, preferDbOverEnv: true };
const { error } = await db.from("app_settings").upsert({ key: "drive_settings", value }, { onConflict: "key" });
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log("OK: rootFolderId 저장 →", rootFolderId);
