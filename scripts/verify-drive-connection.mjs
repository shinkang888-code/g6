/**
 * Drive 연동 확인
 * node scripts/verify-drive-connection.mjs
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { google } from "googleapis";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

loadEnvLocal();

const b64 = process.env.GOOGLE_DRIVE_CREDENTIALS_BASE64;
if (!b64) {
  console.error("GOOGLE_DRIVE_CREDENTIALS_BASE64 없음");
  process.exit(1);
}

const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });

const { data } = await drive.files.list({
  q: "name='LawyGo' and mimeType='application/vnd.google-apps.folder' and trashed=false",
  spaces: "drive",
  fields: "files(id,name)",
  pageSize: 5,
});

let folderId = data.files?.[0]?.id;
if (!folderId) {
  const { data: created } = await drive.files.create({
    requestBody: { name: "LawyGo", mimeType: "application/vnd.google-apps.folder" },
    fields: "id,name",
  });
  folderId = created.id;
  console.log("LawyGo 루트 폴더 생성:", folderId);
} else {
  console.log("LawyGo 루트 폴더 확인:", folderId, data.files[0].name);
}

console.log("서비스 계정:", credentials.client_email);
console.log("\n자료실 Drive 연동 정상");
