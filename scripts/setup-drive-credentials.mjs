/**
 * Google Drive 서비스 계정 JSON → .env.local + app_settings 등록
 * 사용: node scripts/setup-drive-credentials.mjs "경로/키.json"
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "fs";
import path from "path";

const DRIVE_SETTINGS_KEY = "drive_settings";

function loadEnvLocal() {
  const out = {};
  for (const file of [".env.local", "bot/.env", ".env.production.local"]) {
    const abs = path.join(process.cwd(), file);
    if (!existsSync(abs)) continue;
    for (const line of readFileSync(abs, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        const value = m[2].replace(/^["']|["']$/g, "").trim();
        if (value) out[m[1]] = value;
      }
    }
  }
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

function validateJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("유효한 JSON이 아닙니다.");
  }
  if (parsed.type && parsed.type !== "service_account") {
    throw new Error("service_account 키가 아닙니다.");
  }
  const email = String(parsed.client_email ?? "").trim();
  const pk = String(parsed.private_key ?? "").trim();
  if (!email || !pk) throw new Error("client_email 또는 private_key 누락");
  return { email, projectId: parsed.project_id };
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("사용: node scripts/setup-drive-credentials.mjs <서비스계정.json 경로>");
  process.exit(1);
}

const abs = path.resolve(jsonPath);
if (!existsSync(abs)) {
  console.error("파일 없음:", abs);
  process.exit(1);
}

const text = readFileSync(abs, "utf8");
const { email, projectId } = validateJson(text);
const credentialsBase64 = Buffer.from(text, "utf8").toString("base64");

console.log("서비스 계정:", email);
if (projectId) console.log("프로젝트:", projectId);

mergeEnvLocal({ GOOGLE_DRIVE_CREDENTIALS_BASE64: credentialsBase64 });
console.log("OK: .env.local → GOOGLE_DRIVE_CREDENTIALS_BASE64 저장");

const env = { ...loadEnvLocal(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (url && serviceKey) {
  const db = createClient(url, serviceKey);
  const { data: existingRow } = await db
    .from("app_settings")
    .select("value")
    .eq("key", DRIVE_SETTINGS_KEY)
    .maybeSingle();
  const prev = existingRow?.value && typeof existingRow.value === "object" ? existingRow.value : {};
  const payload = {
    credentialsBase64,
    enabled: true,
    ...(typeof prev.rootFolderId === "string" && prev.rootFolderId.trim()
      ? { rootFolderId: prev.rootFolderId.trim() }
      : {}),
  };
  const { data: existing } = await db
    .from("app_settings")
    .select("key")
    .eq("key", DRIVE_SETTINGS_KEY)
    .maybeSingle();

  if (existing) {
    const { error } = await db.from("app_settings").update({ value: payload }).eq("key", DRIVE_SETTINGS_KEY);
    if (error) {
      console.error("DB 업데이트 실패:", error.message);
      process.exit(1);
    }
  } else {
    const { error } = await db.from("app_settings").insert({ key: DRIVE_SETTINGS_KEY, value: payload });
    if (error) {
      console.error("DB 삽입 실패:", error.message);
      process.exit(1);
    }
  }
  console.log("OK: Supabase app_settings.drive_settings 저장");
} else {
  console.warn("Supabase 키 없음 — DB 저장 스킵 (.env.local만 반영)");
}

console.log("\n완료. 개발 서버 재시작 후 /api/drive/status 로 확인하세요.");
console.log("공유 드라이브 사용 시 폴더를", email, "편집자로 공유하거나 관리자 > Google Drive에서 루트 폴더 ID를 설정하세요.");
