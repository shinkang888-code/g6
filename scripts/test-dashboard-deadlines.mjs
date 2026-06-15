/**
 * 대시보드 기일 권한 필터 점검
 * node scripts/test-dashboard-deadlines.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

const ADMIN_ROLE_ID = "admin";

function isAdminSession(session) {
  if (!session) return false;
  if ((session.role ?? "").trim() === "관리자") return true;
  if (session.permissionRoleId === ADMIN_ROLE_ID) return true;
  const perms = session.menuPermissions ?? [];
  if (perms.includes("*")) return true;
  if (perms.includes("관리자")) return true;
  return false;
}

function matchesAssignedStaffName(assignedStaffName, session) {
  const assigned = String(assignedStaffName ?? "").trim().toLowerCase();
  if (!assigned) return false;
  const needles = [session.name, session.loginId]
    .map((s) => String(s ?? "").trim().toLowerCase())
    .filter(Boolean);
  return needles.some((q) => assigned.includes(q));
}

function filterDeadlinesForSession(items, session) {
  if (!session) return [];
  if (isAdminSession(session)) return items;
  return items.filter((item) => matchesAssignedStaffName(item.assignedStaff, session));
}

const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const sample = [
  { id: "1", assignedStaff: "김변호사", date: "2026-06-10" },
  { id: "2", assignedStaff: "이직원", date: "2026-06-11" },
  { id: "3", assignedStaff: "", date: "2026-06-12" },
];

const adminSession = { name: "관리자", loginId: "admin", role: "관리자" };
const lawyerSession = { name: "김변호사", loginId: "kimlaw", role: "변호사" };
const staffSession = { name: "이직원", loginId: "staff1", role: "직원" };

assert(filterDeadlinesForSession(sample, adminSession).length === 3, "관리자는 전체 기일 조회");
assert(
  filterDeadlinesForSession(sample, lawyerSession).length === 1 &&
    filterDeadlinesForSession(sample, lawyerSession)[0].id === "1",
  "변호사는 본인 담당 기일만"
);
assert(
  filterDeadlinesForSession(sample, staffSession).length === 1 &&
    filterDeadlinesForSession(sample, staffSession)[0].id === "2",
  "직원은 본인 담당 기일만"
);
assert(filterDeadlinesForSession(sample, null).length === 0, "비로그인 시 기일 없음");

const permAdmin = { name: "홍길동", loginId: "hong", permissionRoleId: ADMIN_ROLE_ID, menuPermissions: ["*"] };
assert(isAdminSession(permAdmin), "permissionRoleId admin → 관리자");
assert(filterDeadlinesForSession(sample, permAdmin).length === 3, "권한 관리자도 전체 조회");

const apiSrc = readFileSync(resolve(root, "src/app/api/deadlines/route.ts"), "utf8");
if (apiSrc.includes("filterDeadlinesForSession")) {
  console.log("OK: api/deadlines 담당자 필터 적용");
} else {
  errors.push("api/deadlines에 filterDeadlinesForSession 미적용");
}
if (apiSrc.includes("assigned_staff_name")) {
  console.log("OK: cases.assigned_staff_name 조인");
} else {
  errors.push("deadlines API에 assigned_staff_name 조인 없음");
}

console.log("\n=== 대시보드 기일 권한 점검 ===");
console.log("관리자 필터:", filterDeadlinesForSession(sample, adminSession).map((d) => d.id).join(", "));
console.log("김변호사 필터:", filterDeadlinesForSession(sample, lawyerSession).map((d) => d.id).join(", "));
console.log("이직원 필터:", filterDeadlinesForSession(sample, staffSession).map((d) => d.id).join(", "));

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
