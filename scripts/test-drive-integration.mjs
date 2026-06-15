/**
 * Google Drive 연동 종합 테스트
 * node scripts/test-drive-integration.mjs
 */
import { readFileSync, existsSync } from "fs";
import { Readable } from "stream";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

const ROOT_FOLDER_ID = "1nuh_G4MJnFA8WUh4c8jCuORLo7Dew2NI";
const TEST_PATH = "cases/drive-test/files";

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

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function ok(label, detail = "") {
  console.log(`OK: ${label}${detail ? ` — ${detail}` : ""}`);
}

const env = loadEnvFiles();
let credentialsBase64 = env.GOOGLE_DRIVE_CREDENTIALS_BASE64;

if (!credentialsBase64 && env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await db.from("app_settings").select("value").eq("key", "drive_settings").maybeSingle();
  credentialsBase64 = data?.value?.credentialsBase64;
  if (data?.value?.rootFolderId) {
    console.log("DB rootFolderId:", data.value.rootFolderId);
    console.log("DB preferDbOverEnv:", data.value.preferDbOverEnv);
  }
}

if (!credentialsBase64) fail("GOOGLE_DRIVE_CREDENTIALS_BASE64 없음");

// OAuth refresh token (업로드 필수)
let oauthRefreshToken = env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN;
if (!oauthRefreshToken && env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await db.from("app_settings").select("value").eq("key", "drive_settings").maybeSingle();
  oauthRefreshToken = data?.value?.oauthRefreshToken;
  if (data?.value?.rootFolderId) {
    console.log("DB rootFolderId:", data.value.rootFolderId);
    console.log("DB preferDbOverEnv:", data.value.preferDbOverEnv);
    console.log("DB oauthDelegateEmail:", data.value.oauthDelegateEmail ?? "(미연결)");
  }
}

if (!oauthRefreshToken) {
  console.error("\nFAIL: OAuth refresh token 없음");
  console.error("→ 관리자 > Google Drive > 「업로드 권한 연결」을 shinkang888@gmail.com 으로 완료하세요.");
  console.error("→ Google Cloud OAuth 리디렉션 URI:");
  console.error("   https://lawygo.vercel.app/api/admin/settings/drive/oauth/callback");
  process.exit(1);
}

const credentials = JSON.parse(Buffer.from(credentialsBase64, "base64").toString("utf8"));
console.log("서비스 계정:", credentials.client_email);
console.log("OAuth 업로드: refresh token 있음");

const clientId = env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_CLIENT_ID;
const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  fail("Google OAuth Client ID/Secret 없음 — OAuth 업로드 테스트 불가");
}

const oauth2 = new google.auth.OAuth2(
  clientId,
  clientSecret,
  "https://lawygo.vercel.app/api/admin/settings/drive/oauth/callback"
);
oauth2.setCredentials({ refresh_token: oauthRefreshToken });
const drive = google.drive({ version: "v3", auth: oauth2 });

// 1) 루트 폴더 접근
let rootMeta;
try {
  const { data } = await drive.files.get({
    fileId: ROOT_FOLDER_ID,
    fields: "id,name,mimeType,capabilities,shared",
    supportsAllDrives: true,
  });
  rootMeta = data;
  ok("루트 폴더 접근", `${data.name} (${data.id})`);
  if (!data.capabilities?.canAddChildren) {
    fail("루트 폴더에 파일/폴더 생성 권한 없음 — shinkang888@gmail.com Drive에서 서비스 계정을 편집자로 공유했는지 확인");
  }
  ok("루트 폴더 쓰기 권한", "canAddChildren=true");
} catch (e) {
  const msg = e?.response?.data?.error?.message || e?.message || String(e);
  fail(`루트 폴더 접근 실패 (${ROOT_FOLDER_ID}): ${msg}`);
}

// 2) 하위 폴더 생성/조회
async function getOrCreateFolder(parentId, name) {
  const safe = name.replace(/'/g, "\\'");
  const { data } = await drive.files.list({
    q: `name='${safe}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (data.files?.[0]?.id) return data.files[0].id;
  const { data: created } = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id,name",
    supportsAllDrives: true,
  });
  return created.id;
}

let parentId = ROOT_FOLDER_ID;
for (const seg of TEST_PATH.split("/")) {
  parentId = await getOrCreateFolder(parentId, seg);
  if (!parentId) fail(`폴더 생성 실패: ${seg}`);
}
ok("경로 폴더 준비", TEST_PATH);

// 3) 파일 업로드
const testName = `lawygo-drive-test-${Date.now()}.txt`;
const testBody = Buffer.from("LawyGo Drive integration test\n", "utf8");
let uploadedId;
try {
  const { data } = await drive.files.create({
    requestBody: { name: testName, parents: [parentId] },
    media: { mimeType: "text/plain", body: Readable.from(testBody) },
    fields: "id,name,size,webViewLink",
    supportsAllDrives: true,
  });
  uploadedId = data.id;
  ok("파일 업로드", `${data.name} (${data.id})`);
} catch (e) {
  const msg = e?.response?.data?.error?.message || e?.message || String(e);
  if (/storage quota|quota exceeded/i.test(msg)) {
    fail(`저장 공간 오류: 서비스 계정 자체 Drive가 아닌 공유 폴더(${ROOT_FOLDER_ID})에 업로드해야 합니다. ${msg}`);
  }
  fail(`파일 업로드 실패: ${msg}`);
}

// 4) 목록 조회
const { data: listed } = await drive.files.list({
  q: `'${parentId}' in parents and trashed=false`,
  fields: "files(id,name)",
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});
const found = (listed.files ?? []).some((f) => f.id === uploadedId);
if (!found) fail("업로드한 파일이 목록에 없음");
ok("폴더 목록 조회", `${listed.files?.length ?? 0}개 항목`);

// 5) 다운로드
const { data: downloaded } = await drive.files.get(
  { fileId: uploadedId, alt: "media", supportsAllDrives: true },
  { responseType: "arraybuffer" }
);
const text = Buffer.from(downloaded).toString("utf8");
if (!text.includes("LawyGo Drive integration test")) fail("다운로드 내용 불일치");
ok("파일 다운로드");

// 6) 휴지통
await drive.files.update({
  fileId: uploadedId,
  requestBody: { trashed: true },
  supportsAllDrives: true,
});
ok("테스트 파일 정리(휴지통)");

console.log("\n=== Google Drive 연동 테스트 전체 통과 ===");
