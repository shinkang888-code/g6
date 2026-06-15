import { readFileSync, existsSync } from "fs";
import { Readable } from "stream";
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
const ownerEmail = "shinkang888@gmail.com";

// A) 루트에 직접 업로드
try {
  const { data } = await drive.files.create({
    requestBody: { name: `direct-root-test-${Date.now()}.txt`, parents: [rootId] },
    media: { mimeType: "text/plain", body: Readable.from(Buffer.from("direct root test")) },
    fields: "id,name,owners(emailAddress)",
    supportsAllDrives: true,
  });
  console.log("A) 루트 직접 업로드 OK", data.id, data.owners?.map((o) => o.emailAddress));
  await drive.files.update({ fileId: data.id, requestBody: { trashed: true }, supportsAllDrives: true });
} catch (e) {
  console.log("A) 루트 직접 업로드 FAIL", e?.response?.data?.error?.message || e.message);
}

// B) 하위 폴더 생성 후 소유권 이전
const { data: folder } = await drive.files.create({
  requestBody: { name: `sa-folder-test-${Date.now()}`, mimeType: "application/vnd.google-apps.folder", parents: [rootId] },
  fields: "id,owners(emailAddress)",
  supportsAllDrives: true,
});
console.log("B) SA 폴더 생성", folder.id, folder.owners?.map((o) => o.emailAddress));

try {
  await drive.permissions.create({
    fileId: folder.id,
    requestBody: { role: "owner", type: "user", emailAddress: ownerEmail },
    transferOwnership: true,
    supportsAllDrives: true,
  });
  const { data: after } = await drive.files.get({
    fileId: folder.id,
    fields: "owners(emailAddress)",
    supportsAllDrives: true,
  });
  console.log("B) 소유권 이전 후", after.owners?.map((o) => o.emailAddress));

  const { data: up } = await drive.files.create({
    requestBody: { name: "in-transferred-folder.txt", parents: [folder.id] },
    media: { mimeType: "text/plain", body: Readable.from(Buffer.from("after transfer")) },
    fields: "id",
    supportsAllDrives: true,
  });
  console.log("B) 이전된 폴더에 업로드 OK", up.id);
  await drive.files.update({ fileId: up.id, requestBody: { trashed: true }, supportsAllDrives: true });
} catch (e) {
  console.log("B) 소유권 이전/업로드 FAIL", e?.response?.data?.error?.message || e.message);
}

await drive.files.update({ fileId: folder.id, requestBody: { trashed: true }, supportsAllDrives: true });
