/**
 * Google OAuth (로그인·가입) 일괄 설정
 *
 * 사용:
 *   node scripts/setup-google-oauth.mjs --client-id=xxx.apps.googleusercontent.com --client-secret=GOCSPX-...
 *   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... node scripts/setup-google-oauth.mjs
 *
 * Google Cloud Console (프로젝트: lawygo 권장)
 *   → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID (웹)
 *   → 승인된 리디렉션 URI:
 *       https://lawygo.vercel.app/api/auth/google/callback
 *       http://localhost:3000/api/auth/google/callback
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "fs";
import path from "path";

const GOOGLE_OAUTH_SETTINGS_KEY = "google_oauth_settings";
const VERCEL_API = "https://api.vercel.com";

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

function mergeEnvLocal(updates) {
  const file = path.join(process.cwd(), ".env.local");
  const setKeys = new Set(Object.keys(updates));
  let lines = [];
  if (existsSync(file)) lines = readFileSync(file, "utf8").split(/\r?\n/);
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

function parseArgs() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function readVercelProjectLink() {
  try {
    const content = readFileSync(path.join(process.cwd(), ".vercel/project.json"), "utf8");
    const json = JSON.parse(content);
    if (!json.projectId) return null;
    return { projectId: json.projectId, orgId: json.orgId, projectName: json.projectName };
  } catch {
    return null;
  }
}

async function vercelApi(token, pathSuffix, options = {}, teamId) {
  const url = new URL(`${VERCEL_API}${pathSuffix}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  return fetch(url.toString(), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

async function syncToVercel(vars, env) {
  const project = await readVercelProjectLink();
  const token = env.VERCEL_ACCESS_TOKEN?.trim() || env.VERCEL_TOKEN?.trim();
  if (!project || !token) {
    console.warn("Vercel 동기화 스킵: .vercel/project.json 또는 VERCEL_ACCESS_TOKEN 없음");
    return;
  }

  const res = await vercelApi(token, `/v9/projects/${project.projectId}/env`, {}, project.orgId);
  const json = await res.json().catch(() => ({}));
  const existing = Array.isArray(json.envs) ? json.envs : [];

  for (const [key, value] of Object.entries(vars)) {
    for (const row of existing.filter((r) => r.key === key)) {
      await vercelApi(
        token,
        `/v9/projects/${project.projectId}/env/${row.id}`,
        { method: "DELETE" },
        project.orgId
      );
    }
    const createRes = await vercelApi(
      token,
      `/v10/projects/${project.projectId}/env`,
      {
        method: "POST",
        body: JSON.stringify({
          key,
          value: value.trim(),
          type: "encrypted",
          target: ["production", "preview", "development"],
        }),
      },
      project.orgId
    );
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(`Vercel env ${key}: ${err.error?.message ?? createRes.status}`);
    }
    console.log(`OK: Vercel env → ${key}`);
  }
  console.log("→ Vercel 재배포 후 프로덕션 Google 로그인이 활성화됩니다.");
}

const args = parseArgs();
const env = { ...loadEnvLocal(), ...process.env };
const clientId = (args["client-id"] || env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
const clientSecret = (args["client-secret"] || env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();

if (!clientId || !clientSecret) {
  console.error(`
Google OAuth Client ID/Secret이 필요합니다.

1) Google Cloud Console → https://console.cloud.google.com/apis/credentials?project=lawygo
2) 「+ 사용자 인증 정보 만들기」→ OAuth 클라이언트 ID → 웹 애플리케이션
3) 승인된 리디렉션 URI 추가:
   - https://lawygo.vercel.app/api/auth/google/callback
   - http://localhost:3000/api/auth/google/callback
4) 아래 명령 실행:

   node scripts/setup-google-oauth.mjs --client-id=YOUR_ID.apps.googleusercontent.com --client-secret=GOCSPX-...
`);
  process.exit(1);
}

console.log("Client ID:", clientId.slice(0, 20) + "…");

mergeEnvLocal({
  GOOGLE_OAUTH_CLIENT_ID: clientId,
  GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
});
console.log("OK: .env.local 저장");

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (url && serviceKey) {
  const db = createClient(url, serviceKey);
  const payload = { clientId, clientSecret, enabled: true };
  const { data: existing } = await db
    .from("app_settings")
    .select("key")
    .eq("key", GOOGLE_OAUTH_SETTINGS_KEY)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("app_settings")
      .update({ value: payload })
      .eq("key", GOOGLE_OAUTH_SETTINGS_KEY);
    if (error) throw new Error(`DB 업데이트 실패: ${error.message}`);
  } else {
    const { error } = await db
      .from("app_settings")
      .insert({ key: GOOGLE_OAUTH_SETTINGS_KEY, value: payload });
    if (error) throw new Error(`DB 삽입 실패: ${error.message}`);
  }
  console.log("OK: Supabase app_settings.google_oauth_settings 저장 (즉시 프로덕션 반영)");
} else {
  console.warn("Supabase 키 없음 — DB 저장 스킵");
}

try {
  await syncToVercel(
    { GOOGLE_OAUTH_CLIENT_ID: clientId, GOOGLE_OAUTH_CLIENT_SECRET: clientSecret },
    env
  );
} catch (e) {
  console.warn("Vercel 동기화 실패:", e.message || e);
}

console.log("\n완료. 로컬: dev 서버 재시작 후 /login 에서 Google 버튼 확인");
console.log("프로덕션: DB 저장 시 재배포 없이 즉시 동작, Vercel env만 쓰는 경우 재배포 필요");
