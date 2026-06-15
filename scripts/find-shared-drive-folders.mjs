/**
 * 서비스 계정에 공유된 Drive 폴더 탐색
 * node scripts/find-shared-drive-folders.mjs
 */
import { readFileSync, existsSync } from "fs";
import path from "path";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}

loadEnvLocal();

const { google } = await import("googleapis");
const cred = JSON.parse(
  Buffer.from(process.env.GOOGLE_DRIVE_CREDENTIALS_BASE64, "base64").toString("utf8")
);
const auth = new google.auth.GoogleAuth({
  credentials: cred,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });

const { data: drives } = await drive.drives.list({ pageSize: 20 });
console.log("공유 드라이브:", (drives.drives ?? []).map((d) => ({ id: d.id, name: d.name })));

const queries = [
  "sharedWithMe=true and mimeType='application/vnd.google-apps.folder' and trashed=false",
  "mimeType='application/vnd.google-apps.folder' and name contains 'LawyGo' and trashed=false",
];

for (const q of queries) {
  const { data } = await drive.files.list({
    q,
    pageSize: 20,
    fields: "files(id,name,owners,shared,driveId,capabilities)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  console.log("\nquery:", q);
  for (const f of data.files ?? []) {
    console.log(" -", f.name, f.id, "driveId:", f.driveId ?? "-", "canAdd:", f.capabilities?.canAddChildren);
  }
}
