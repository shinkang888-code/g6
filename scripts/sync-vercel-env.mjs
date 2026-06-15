/**
 * 로이고키.txt + Supabase → Vercel 환경 변수 동기화
 * node scripts/sync-vercel-env.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";

const KEYS_FILE = process.env.LAWYGO_KEYS_FILE || "C:/Users/FORYOUCOM/Downloads/로이고키.txt";

function parseKeysFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const out = {};
  const urlMatch = text.match(/https:\/\/[a-z0-9]+\.supabase\.co/i);
  if (urlMatch) out.NEXT_PUBLIC_SUPABASE_URL = urlMatch[0];
  const anonMatch = text.match(/anon\s*\n?(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/i);
  if (anonMatch) out.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonMatch[1].trim();
  const serviceMatch = text.match(/service\s*role\s*\n?(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/i);
  if (serviceMatch) out.SUPABASE_SERVICE_ROLE_KEY = serviceMatch[1].trim();
  const clientIdMatch = text.match(/GOOGLE_CLIENT_ID\s*\n?(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)/i);
  if (clientIdMatch) out.GOOGLE_CLIENT_ID = clientIdMatch[1].trim();
  const clientSecretMatch = text.match(/GOOGLE_CLIENT_SECRET\s*\n?(GOCSPX-[A-Za-z0-9_-]+)/i);
  if (clientSecretMatch) out.GOOGLE_CLIENT_SECRET = clientSecretMatch[1].trim();

  const driveIdMatch = text.match(
    /구글오스\s*클라이언트[\s\S]*?(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)/i
  );
  if (driveIdMatch) out.GOOGLE_DRIVE_OAUTH_CLIENT_ID = driveIdMatch[1].trim();

  const driveSecrets = [...text.matchAll(/GOCSPX-[A-Za-z0-9_-]+/g)].map((m) => m[0]);
  if (driveSecrets.length >= 2) {
    out.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = driveSecrets[1];
  } else if (driveSecrets.length === 1 && driveIdMatch) {
    out.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = driveSecrets[0];
  }

  out.ENABLE_DEMO_LOGIN = "true";
  return out;
}

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

function vercelEnvAdd(name, value, env = "production") {
  const r = spawnSync(
    "npx",
    ["vercel", "env", "add", name, env, "--force"],
    { input: value, encoding: "utf8", shell: true, cwd: process.cwd() }
  );
  if (r.status !== 0) {
    console.error(`FAIL ${name}:`, r.stderr || r.stdout);
    return false;
  }
  console.log(`OK: ${name} (${env})`);
  return true;
}

const keys = parseKeysFile(KEYS_FILE);
const local = loadEnvLocal();
Object.assign(keys, local);

if (keys.NEXT_PUBLIC_SUPABASE_URL && keys.SUPABASE_SERVICE_ROLE_KEY) {
  const db = createClient(keys.NEXT_PUBLIC_SUPABASE_URL, keys.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await db.from("app_settings").select("value").eq("key", "drive_settings").maybeSingle();
  if (data?.value?.credentialsBase64) {
    keys.GOOGLE_DRIVE_CREDENTIALS_BASE64 = data.value.credentialsBase64;
  }
  if (data?.value?.rootFolderId) {
    keys.GOOGLE_DRIVE_ROOT_FOLDER_ID = data.value.rootFolderId;
  }
  if (data?.value?.oauthClientId) {
    keys.GOOGLE_DRIVE_OAUTH_CLIENT_ID = data.value.oauthClientId;
  }
  if (data?.value?.oauthClientSecret) {
    keys.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = data.value.oauthClientSecret;
  }
}

const targets = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_DRIVE_CREDENTIALS_BASE64",
  "GOOGLE_DRIVE_ROOT_FOLDER_ID",
  "GOOGLE_DRIVE_OAUTH_CLIENT_ID",
  "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ENABLE_DEMO_LOGIN",
  "PLATFORM_ADMIN_LOGIN_IDS",
  "PLATFORM_ADMIN_MANAGEMENT_NUMBERS",
];

if (!keys.PLATFORM_ADMIN_LOGIN_IDS) keys.PLATFORM_ADMIN_LOGIN_IDS = "shinkang";
if (!keys.PLATFORM_ADMIN_MANAGEMENT_NUMBERS) keys.PLATFORM_ADMIN_MANAGEMENT_NUMBERS = "00000,10000";

let ok = 0;
for (const name of targets) {
  const val = keys[name];
  if (!val) {
    console.log(`SKIP: ${name} (값 없음)`);
    continue;
  }
  if (vercelEnvAdd(name, val, "production")) ok++;
  vercelEnvAdd(name, val, "preview");
}

console.log(`\n완료: ${ok}개 production 변수 반영`);
