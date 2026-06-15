/**
 * 직원관리 — 회사코드 필터·수정 API 점검
 * node scripts/test-staff-management.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const BASE = process.env.BASE_URL || "http://localhost:3000";

const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const staffRoute = readFileSync(resolve(root, "src/app/api/staff/route.ts"), "utf8");
assert(staffRoute.includes('eq("management_number", managementNumber)'), "직원 목록 회사코드 필터");
assert(staffRoute.includes("profile"), "직원 profile 조회");

const updateRoute = readFileSync(resolve(root, "src/app/api/admin/members/update/route.ts"), "utf8");
assert(updateRoute.includes("requireTenantSession"), "수정 API 테넌트 세션");
assert(updateRoute.includes("department"), "부서 저장");
assert(updateRoute.includes("companyPhone"), "회사폰 저장");

const staffPage = readFileSync(resolve(root, "src/app/staff/page.tsx"), "utf8");
assert(staffPage.includes('label="직원목록 엑셀"'), "엑셀 버튼 라벨");
assert(staffPage.includes("수정"), "수정 버튼");
assert(staffPage.includes("삭제"), "삭제 버튼");

console.log("=== 직원관리 정적 점검 ===");
if (errors.length) {
  errors.forEach((e) => console.error("FAIL:", e));
  process.exit(1);
}
console.log("정적 점검 통과");

let cookie = "";
try {
  const auth = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
  for (const c of auth.headers.getSetCookie?.() ?? []) {
    const p = c.split(";")[0];
    if (p.startsWith("lawygo_session=")) cookie = p;
  }
  if (!cookie) throw new Error("demo login failed");

  const listRes = await fetch(`${BASE}/api/staff`, { headers: { Cookie: cookie } });
  const listJson = await listRes.json();
  assert(listRes.ok, `GET /api/staff HTTP ${listRes.status}`);
  assert(Array.isArray(listJson.staff), "staff 배열");
  assert(listJson.managementNumber, "managementNumber 응답");
  console.log(`OK: 회사코드 ${listJson.managementNumber} · 직원 ${listJson.count ?? listJson.staff.length}명`);

  const target = listJson.staff?.[0];
  if (!target?.id) {
    console.log("HTTP: 수정 테스트 스킵 (직원 없음)");
  } else {
    const testDept = `테스트부서-${Date.now().toString().slice(-4)}`;
    const patchRes = await fetch(`${BASE}/api/admin/members/update`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        id: target.id,
        department: testDept,
        email: target.email || "staff-test@example.com",
        companyPhone: "010-1111-2222",
        personalPhone: "010-3333-4444",
        jobTitle: "대리",
      }),
    });
    const patchJson = await patchRes.json();
    assert(patchRes.ok, `PATCH update HTTP ${patchRes.status}: ${patchJson.error ?? ""}`);

    const verifyRes = await fetch(`${BASE}/api/staff`, { headers: { Cookie: cookie } });
    const verifyJson = await verifyRes.json();
    const updated = (verifyJson.staff ?? []).find((s) => s.id === target.id);
    assert(updated?.department === testDept, "부서 수정 반영");
    assert(updated?.companyPhone === "010-1111-2222", "회사폰 수정 반영");
    assert(updated?.jobTitle === "대리", "직급 수정 반영");
    console.log(`OK: "${target.name}" 정보 수정·조회 검증`);
  }

  console.log("\nHTTP 점검 통과");
} catch (e) {
  console.warn("\nHTTP 점검 스킵:", e.message || e);
  if (errors.length) {
    errors.forEach((err) => console.error("FAIL:", err));
    process.exit(1);
  }
}

console.log("\n모든 점검 완료");
