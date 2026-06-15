/**
 * 로이고키.txt + Supabase drive_settings → .env.local 동기화
 * node scripts/sync-env-from-keys.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "fs";
import path from "path";

const KEYS_FILE = process.env.LAWYGO_KEYS_FILE || "C:/Users/FORYOUCOM/Downloads/로이고키.txt";

function parseKeysFile(filePath) {
  if (!existsSync(filePath)) throw new Error(`키 파일 없음: ${filePath}`);
  const text = readFileSync(filePath, "utf8");
  const out = {};

  const urlMatch = text.match(/https:\/\/[a-z0-9]+\.supabase\.co/i);
  if (urlMatch) out.NEXT_PUBLIC_SUPABASE_URL = urlMatch[0];

  const anonMatch = text.match(
    /anon\s*\n?(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/i
  );
  if (anonMatch) out.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonMatch[1].trim();

  const serviceMatch = text.match(
    /service\s*role\s*\n?(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/i
  );
  if (serviceMatch) out.SUPABASE_SERVICE_ROLE_KEY = serviceMatch[1].trim();

  const clientIdMatch = text.match(
    /GOOGLE_CLIENT_ID\s*\n?(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)/i
  );
  if (clientIdMatch) out.GOOGLE_CLIENT_ID = clientIdMatch[1].trim();

  const clientSecretMatch = text.match(/GOOGLE_CLIENT_SECRET\s*\n?(GOCSPX-[A-Za-z0-9_-]+)/i);
  if (clientSecretMatch) out.GOOGLE_CLIENT_SECRET = clientSecretMatch[1].trim();

  const lawOcMatch = text.match(/LAW_GO_KR_OC[=:\s"]*([^\s\r\n"]+)/i);
  if (lawOcMatch) out.LAW_GO_KR_OC = lawOcMatch[1].trim();

  out.ENABLE_DEMO_LOGIN = "true";
  out.GOOGLE_OAUTH_LOCALE = "ko";

  return out;
}

function mergeEnvLocal(updates) {
  const file = path.join(process.cwd(), ".env.local");
  const setKeys = new Set(Object.keys(updates));
  let lines = [];
  if (existsSync(file)) {
    lines = readFileSync(file, "utf8").split(/\r?\n/);
  }
  const updated = lines
    .filter((line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
      return !match || !setKeys.has(match[1]);
    })
    .concat(
      Object.entries(updates)
        .filter(([, v]) => String(v).trim())
        .map(([k, v]) => `${k}=${String(v).replace(/\n/g, " ")}`)
    );
  writeFileSync(file, updated.join("\n") + "\n", "utf8");
}

async function fetchDriveBase64(url, serviceKey) {
  const db = createClient(url, serviceKey);
  const { data, error } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "drive_settings")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const b64 = data?.value?.credentialsBase64;
  if (!b64) throw new Error("Supabase drive_settings.credentialsBase64 없음");
  return b64;
}

async function main() {
  console.log("키 파일:", KEYS_FILE);
  const keys = parseKeysFile(KEYS_FILE);
  console.log("파싱:", Object.keys(keys).join(", "));

  if (!keys.NEXT_PUBLIC_SUPABASE_URL || !keys.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase URL/Service Role 키 파싱 실패");
  }

  const driveB64 = await fetchDriveBase64(
    keys.NEXT_PUBLIC_SUPABASE_URL,
    keys.SUPABASE_SERVICE_ROLE_KEY
  );
  keys.GOOGLE_DRIVE_CREDENTIALS_BASE64 = driveB64;

  if (!keys.SESSION_SECRET) {
    keys.SESSION_SECRET = "lawygo-local-dev-session-" + Date.now().toString(36);
  }

  mergeEnvLocal(keys);
  console.log("OK: .env.local 업데이트 완료");
  console.log("  - Supabase URL/키");
  console.log("  - Google OAuth");
  console.log("  - GOOGLE_DRIVE_CREDENTIALS_BASE64 (Supabase에서 로드)");
}

main().catch((e) => {
  console.error("실패:", e.message);
  process.exit(1);
});
