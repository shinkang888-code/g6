import { readFileSync, existsSync } from "fs";
import { google } from "googleapis";

function loadEnv() {
  const out = {};
  for (const f of ["bot/.env", ".env.local"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        const v = m[2].replace(/^["']|["']$/g, "").trim();
        if (v) out[m[1]] = v;
      }
    }
  }
  return out;
}

const env = loadEnv();
const cred = JSON.parse(Buffer.from(env.GOOGLE_DRIVE_CREDENTIALS_BASE64, "base64").toString("utf8"));
const drive = google.drive({
  version: "v3",
  auth: new google.auth.GoogleAuth({
    credentials: cred,
    scopes: ["https://www.googleapis.com/auth/drive"],
  }),
});

const id = process.argv[2] || "1nuh_G4MJnFA8WUh4c8jCuORLo7Dew2NI";
const { data } = await drive.files.get({
  fileId: id,
  fields: "id,name,owners,shared,driveId,capabilities,parents",
  supportsAllDrives: true,
});
console.log("folder:", JSON.stringify(data, null, 2));

const { data: perms } = await drive.permissions.list({
  fileId: id,
  fields: "permissions(emailAddress,role,type)",
  supportsAllDrives: true,
});
console.log("permissions:", JSON.stringify(perms.permissions, null, 2));

// shared drives 목록
const { data: drives } = await drive.drives.list({ pageSize: 10 });
console.log("shared drives:", JSON.stringify(drives.drives ?? [], null, 2));
