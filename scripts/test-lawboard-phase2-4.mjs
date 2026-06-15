#!/usr/bin/env node
/**
 * LawBoard Phase 2-4 — API·모듈 정적 검증
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const required = [
  "src/lib/boardService.ts",
  "src/lib/boardBridge.ts",
  "src/lib/boardApiContext.ts",
  "src/lib/mailService.ts",
  "src/app/api/mail/route.ts",
  "src/app/mail/page.tsx",
  "src/app/api/admin/boards/route.ts",
  "supabase/migrations/20260615010000_lawboard_phase2_4.sql",
  "docs/LAWBOARD_ROADMAP.md",
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

const postPage = readFileSync(join(root, "src/app/board/[boardId]/post/[postId]/page.tsx"), "utf8");
if (postPage.includes("handleSubmitComment") && postPage.includes("co_content")) {
  console.log("OK board post page has comment write UI");
} else {
  console.error("FAIL board post page missing comment UI");
  failed++;
}

const boardPage = readFileSync(join(root, "src/app/board/page.tsx"), "utf8");
if (boardPage.includes("nativeBoard")) {
  console.log("OK board/page.tsx uses native Supabase board");
} else {
  console.error("FAIL board/page.tsx still G6-only");
  failed++;
}

const boardRoute = readFileSync(join(root, "src/app/api/board/route.ts"), "utf8");
if (boardRoute.includes("nativeBoard")) {
  console.log("OK /api/board returns nativeBoard flag");
} else {
  console.error("FAIL /api/board missing nativeBoard");
  failed++;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nLawBoard Phase 2-4 static checks passed.");
