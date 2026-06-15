/**
 * LawBoard Vercel G6 연동 환경 변수 설정
 * node scripts/setup-g6-vercel-env.mjs
 */
import { spawnSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";

function loadEnvFile(name) {
  const out = {};
  const file = path.join(process.cwd(), name);
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v) out[m[1]] = v;
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

const local = loadEnvFile(".env.local");
const g6ProdUrl = process.env.G6_PRODUCTION_URL || "https://g6-jet.vercel.app";

const vars = {
  NEXT_PUBLIC_GNUBOARD_API_URL: g6ProdUrl,
  GNUBOARD_API_USERNAME: local.GNUBOARD_API_USERNAME || "lawygo",
  GNUBOARD_API_PASSWORD: local.GNUBOARD_API_PASSWORD || "lawygo1234!",
  BOARD_BRIDGE_PREFER: local.BOARD_BRIDGE_PREFER || "hybrid",
};

for (const [name, val] of Object.entries(vars)) {
  if (!val) {
    console.log(`SKIP: ${name}`);
    continue;
  }
  for (const env of ["production", "preview", "development"]) {
    vercelEnvAdd(name, val, env);
  }
}

console.log("\nLawBoard Vercel G6 env 설정 완료. npx vercel --prod 로 재배포하세요.");
