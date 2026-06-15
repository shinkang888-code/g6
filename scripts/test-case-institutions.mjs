/**
 * case_institutions 순수 함수 단위 검증
 * node scripts/test-case-institutions.mjs
 */

function inferTrialLevel(caseNumber) {
  const n = String(caseNumber ?? "").replace(/\s/g, "");
  if (/^(\d{4})두|^(\d{4})노|^(\d{4})도|^(\d{4})르|^(\d{4})머/.test(n)) return "2심";
  if (/^(\d{4})다|^(\d{4})스|^(\d{4})재/.test(n)) return "3심";
  return "1심";
}

function trialLevelToCourtStage(level) {
  if (level === "2심") return "court_2";
  if (level === "3심") return "court_3";
  return "court_1";
}

function extractPhoneFromCourtDivision(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const m = text.match(/(?:전화|Tel|TEL)\s*[:：]?\s*([0-9][0-9\-.\s]{8,})/i);
  if (m?.[1]) return m[1].replace(/\s+/g, " ").trim();
  const m2 = text.match(/(?:0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}|010[-.\s]?\d{4}[-.\s]?\d{4})/);
  return m2?.[0]?.trim() ?? null;
}

function institutionHasData(inst) {
  return Boolean(
    inst.agencyName?.trim() ||
      inst.caseNumber?.trim() ||
      inst.department?.trim() ||
      inst.contactName?.trim() ||
      inst.phone?.trim() ||
      inst.mobile?.trim()
  );
}

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

console.log("inferTrialLevel");
assert(inferTrialLevel("2024두12345") === "2심", "2심 사건번호");
assert(inferTrialLevel("2024다67890") === "3심", "3심 사건번호");
assert(inferTrialLevel("2025고단123") === "1심", "1심 형사");

console.log("trialLevelToCourtStage");
assert(trialLevelToCourtStage("2심") === "court_2", "2심 → court_2");

console.log("extractPhoneFromCourtDivision");
assert(
  extractPhoneFromCourtDivision("제 3 형사부(나) (전화:031-828-0421)") === "031-828-0421",
  "전화: 패턴"
);

console.log("institutionHasData");
assert(institutionHasData({ agencyName: "인천지법" }), "기관명 있음");
assert(!institutionHasData({ agencyName: "" }), "빈 기관");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
