/**
 * Drive 업로드 직접 테스트
 * node scripts/test-drive-upload.mjs
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

const { getDriveClient, uploadFile } = await import("../src/lib/googleDriveClient.ts");
const { ensureCompanyDriveFolders, buildCompanySharedPath } = await import(
  "../src/lib/driveCompanyFolders.ts"
);

const mn = "10000";
const drive = await getDriveClient();
if (!drive) throw new Error("Drive client null");

await ensureCompanyDriveFolders(mn);
const folderPath = buildCompanySharedPath(mn);
const name = `local-upload-test-${Date.now()}.txt`;
const result = await uploadFile(
  drive,
  folderPath,
  name,
  Buffer.from("LawyGo drive upload test"),
  "text/plain"
);

console.log("upload result:", result);
process.exit(result?.fileId ? 0 : 1);
