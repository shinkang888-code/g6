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
  auth: new google.auth.GoogleAuth({ credentials: cred, scopes: ["https://www.googleapis.com/auth/drive"] }),
});

const rootId = "1nuh_G4MJnFA8WUh4c8jCuORLo7Dew2NI";
const { data } = await drive.files.list({
  q: `'${rootId}' in parents and trashed=false`,
  fields: "files(id,name,mimeType,owners(emailAddress))",
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
});
for (const f of data.files ?? []) {
  console.log(f.name, f.id, "owners:", f.owners?.map((o) => o.emailAddress).join(", "));
}
