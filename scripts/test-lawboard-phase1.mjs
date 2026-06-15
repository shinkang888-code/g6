#!/usr/bin/env node
/**
 * LawBoard Phase 1 — API·모듈 정적 검증
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const required = [
  "src/lib/consultationService.ts",
  "src/lib/consultationClient.ts",
  "src/lib/noticeClient.ts",
  "src/app/api/consultations/route.ts",
  "src/app/api/consultation-rooms/route.ts",
  "supabase/migrations/20260615000000_lawboard_phase1.sql",
  "README.md",
];

let failed = 0;
for (const rel of required) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    console.error(`FAIL missing: ${rel}`);
    failed++;
  } else {
    console.log(`OK ${rel}`);
  }
}

const noticesPage = readFileSync(join(root, "src/app/notices/page.tsx"), "utf8");
if (noticesPage.includes("noticeStorage")) {
  console.error("FAIL notices/page.tsx still uses noticeStorage (localStorage)");
  failed++;
} else if (noticesPage.includes("fetchNotices")) {
  console.log("OK notices/page.tsx uses Supabase API");
} else {
  console.error("FAIL notices/page.tsx API integration unclear");
  failed++;
}

const consultPage = readFileSync(join(root, "src/app/consultation/page.tsx"), "utf8");
if (consultPage.includes("fetchConsultations")) {
  console.log("OK consultation/page.tsx uses consultationClient");
} else {
  console.error("FAIL consultation/page.tsx missing API client");
  failed++;
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (pkg.name === "lawboard") {
  console.log("OK package.json name=lawboard");
} else {
  console.error(`FAIL package name is ${pkg.name}`);
  failed++;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nLawBoard Phase 1 static checks passed.");
