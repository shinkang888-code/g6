/**
 * 법원기일연동 단건 테스트
 * npx tsx scripts/test-court-sync.ts <caseId> [userId]
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

function loadEnvFile(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      const v = m[2].trim();
      if (k && v && process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(root, "bot/.env"));
loadEnvFile(resolve(root, ".env.local"));

const caseId = process.argv[2] ?? "58045e05-2c42-420d-88db-6151f1d0ee23";
const userId = process.argv[3] ?? "shinkang";

async function main() {
  const { syncCaseDeadlines } = await import("../src/lib/courtDeadlineSync");
  console.log("Testing sync for case:", caseId);
  const result = await syncCaseDeadlines(caseId, userId);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
