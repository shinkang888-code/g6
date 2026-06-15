/**
 * LAW_GO_KR_OC + VERCEL_ACCESS_TOKEN → .env.local, DB, Vercel
 * LAW_OC=xxx VERCEL_TOKEN=xxx node scripts/apply-law-open-api-env.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const envPath = join(root, ".env.local");

const LAW_OC = (process.env.LAW_OC ?? "").trim();
const VERCEL_TOKEN = (process.env.VERCEL_TOKEN ?? "").trim();

if (!LAW_OC) {
  console.error("LAW_OC 환경 변수가 필요합니다.");
  process.exit(1);
}

async function mergeEnvLocal(updates) {
  let lines = [];
  try {
    lines = (await readFile(envPath, "utf8")).split(/\r?\n/);
  } catch {
    /* new */
  }
  const setKeys = new Set(Object.keys(updates));
  const updated = lines
    .filter((line) => {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
      return !m || !setKeys.has(m[1]);
    })
    .concat(Object.entries(updates).map(([k, v]) => `${k}=${v}`));
  await writeFile(envPath, updated.join("\n") + "\n", "utf8");
}

async function loadEnvFile(path) {
  const out = {};
  try {
    const content = await readFile(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[k] = v;
    }
  } catch {
    /* */
  }
  return out;
}

async function saveDb(oc) {
  const env = await loadEnvFile(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("SKIP DB: Supabase env 없음");
    return false;
  }
  const value = { oc, enabled: true, updatedAt: new Date().toISOString() };
  const res = await fetch(`${url}/rest/v1/app_settings`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ key: "law_open_api_settings", value }),
  });
  if (!res.ok) {
    console.warn("DB 저장 실패:", await res.text());
    return false;
  }
  console.log("OK: DB app_settings 저장");
  return true;
}

async function syncVercel(oc, token) {
  const project = JSON.parse(await readFile(join(root, ".vercel/project.json"), "utf8"));
  const projectId = project.projectId;
  const teamId = project.orgId;
  const base = "https://api.vercel.com";
  const q = teamId ? `?teamId=${teamId}` : "";

  const listRes = await fetch(`${base}/v9/projects/${projectId}/env${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listJson = await listRes.json();
  if (!listRes.ok) throw new Error(listJson.error?.message ?? "env 목록 실패");

  for (const row of listJson.envs ?? []) {
    if (row.key === "LAW_GO_KR_OC") {
      await fetch(`${base}/v9/projects/${projectId}/env/${row.id}${q}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }

  const createRes = await fetch(`${base}/v10/projects/${projectId}/env${q}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: "LAW_GO_KR_OC",
      value: oc,
      type: "encrypted",
      target: ["production", "preview", "development"],
    }),
  });
  const createJson = await createRes.json();
  if (!createRes.ok) throw new Error(createJson.error?.message ?? "env 생성 실패");
  console.log("OK: Vercel LAW_GO_KR_OC 반영");
}

async function testArticle() {
  for (const base of ["http://localhost:3001", "http://localhost:3000"]) {
    try {
      const res = await fetch(
        `${base}/api/law/article?law=${encodeURIComponent("건축법")}&articleNo=24`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (!res.ok) continue;
      const json = await res.json();
      console.log(`OK: 조문 API source=${json.source} (${base})`);
      return;
    } catch {
      /* next */
    }
  }
  console.log("SKIP: dev 서버 미실행 — API 검증 생략");
}

const updates = { LAW_GO_KR_OC: LAW_OC };
if (VERCEL_TOKEN) updates.VERCEL_ACCESS_TOKEN = VERCEL_TOKEN;

await mergeEnvLocal(updates);
console.log("OK: .env.local 저장", Object.keys(updates).join(", "));

await saveDb(LAW_OC);

if (VERCEL_TOKEN) {
  await syncVercel(LAW_OC, VERCEL_TOKEN);
} else {
  console.warn("SKIP Vercel: VERCEL_TOKEN 없음");
}

await testArticle();
console.log("완료");
