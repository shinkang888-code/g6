/**
 * case_parties 순수 함수 단위 검증
 * node scripts/test-case-parties.mjs
 */

function formatOpponentSummary(names) {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list[0]} 외 ${list.length - 1}명`;
}

function buildPartiesFromLegacyCase(row) {
  const out = [];
  const clientName = String(row.client_name ?? "").trim();
  if (clientName && clientName !== "(의뢰인 없음)") {
    out.push({ role: "client", sortOrder: 0, name: clientName });
  }
  const opponentRaw = String(row.opponent_name ?? "").trim();
  if (opponentRaw) {
    const names = opponentRaw.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    const expanded = names.length > 0 ? names : [opponentRaw.split(" 외 ")[0].trim()];
    expanded.forEach((name, i) => out.push({ role: "opponent", sortOrder: i, name }));
  }
  return out;
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

console.log("formatOpponentSummary");
assert(formatOpponentSummary([]) === "", "빈 목록");
assert(formatOpponentSummary(["홍길동"]) === "홍길동", "1명");
assert(formatOpponentSummary(["홍길동", "김철수", "이영희"]) === "홍길동 외 2명", "3명 요약");

console.log("buildPartiesFromLegacyCase");
const seed = buildPartiesFromLegacyCase({
  client_name: "임이도",
  client_position: "피의자",
  opponent_name: "검사, 피해자",
});
assert(seed.length === 3, "의뢰인 1 + 상대 2");
assert(seed[0].role === "client" && seed[0].name === "임이도", "의뢰인");
assert(seed[1].role === "opponent", "상대방1");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
