/**
 * LawBoard Vercel 필수 환경 변수 설정 (bot/.env 기반)
 * node scripts/setup-lawboard-vercel-env.mjs
 */
import crypto from "crypto";
import { readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";

function loadBotEnv() {
  const out = {};
  for (const name of [".env.local", "bot/.env"]) {
    const file = path.join(process.cwd(), name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  return out;
}

function vercelEnvAdd(name, value, env) {
  const r = spawnSync("npx", ["vercel", "env", "add", name, env, "--force"], {
    input: value,
    encoding: "utf8",
    shell: true,
    cwd: process.cwd(),
  });
  if (r.status !== 0) {
    console.error(`FAIL ${name} (${env}):`, r.stderr || r.stdout);
    return false;
  }
  console.log(`OK: ${name} (${env})`);
  return true;
}

const bot = loadBotEnv();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || bot.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const vars = {
  NEXT_PUBLIC_SUPABASE_URL: bot.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: bot.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  ENABLE_DEMO_LOGIN: "true",
  LEDGER_ENABLED: "false",
  SESSION_SECRET: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
};

for (const [name, val] of Object.entries(vars)) {
  if (!val) {
    console.log(`SKIP: ${name}`);
    continue;
  }
  vercelEnvAdd(name, val, "production");
  vercelEnvAdd(name, val, "preview");
  vercelEnvAdd(name, val, "development");
}

console.log("\nVercel env 설정 완료. vercel --prod 로 재배포하세요.");
