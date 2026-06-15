/**
 * user_lawygo.xls 실제 직원 데이터로 회원(site_users) + 직원(staff) 갱신
 * - 관리자(login_id=shinkang) 제외한 기존 회원·직원 전부 삭제 후 엑셀 행 삽입
 * - 아이디: 엑셀 ID 컬럼, 비밀번호: 엑셀에 **** 표시이므로 환경변수 STAFF_INITIAL_PASSWORD 사용 (없으면 lawygo1!)
 *
 * 사용:
 *   node scripts/seed-users-from-excel.mjs "c:\...\user_lawygo.xls"
 *   STAFF_INITIAL_PASSWORD=초기비밀번호 node scripts/seed-users-from-excel.mjs "c:\...\user_lawygo.xls"
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import XLSX from "xlsx";
import { readFileSync, existsSync } from "fs";
import path from "path";

const SALT_LEN = 16;
const KEY_LEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
const ADMIN_LOGIN_ID = "shinkang";
const DEFAULT_INITIAL_PASSWORD = "lawygo1!";

function hashPassword(plain) {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const hash = crypto.scryptSync(plain, salt, KEY_LEN, SCRYPT_OPTIONS).toString("hex");
  return `${salt}:${hash}`;
}

function loadEnvLocal() {
  const root = path.resolve(process.cwd());
  const file = path.join(root, ".env.local");
  if (!existsSync(file)) return;
  const content = readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const initialPassword = process.env.STAFF_INITIAL_PASSWORD || process.env.INITIAL_PASSWORD || DEFAULT_INITIAL_PASSWORD;
const excelPath = process.argv[2] || path.join(process.cwd(), "user_lawygo.xls");

if (!url || !serviceKey) {
  console.error("오류: .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 설정하세요.");
  process.exit(1);
}

const excelPathResolved = path.isAbsolute(excelPath) ? excelPath : path.join(process.cwd(), excelPath);
if (!existsSync(excelPathResolved)) {
  console.error("오류: 엑셀 파일을 찾을 수 없습니다.", excelPathResolved);
  process.exit(1);
}

/** 사용자유형(엑셀) → DB role */
function mapRole(사용자유형) {
  const s = String(사용자유형 ?? "").trim();
  if (s.includes("변호사")) return "변호사";
  if (s.includes("관리자")) return "관리자";
  if (s.includes("사무장") || s.includes("국장")) return s.includes("국장") ? "국장" : "사무장";
  if (s.includes("임원")) return "임원";
  if (s.includes("인턴")) return "인턴";
  if (s.includes("사무원")) return "사무원";
  if (s === "기타" || s) return "직원";
  return "직원";
}

function roleToLevel(role) {
  if (role === "관리자" || role === "임원") return 5;
  if (role === "변호사") return 3;
  if (role === "사무장" || role === "국장") return 2;
  if (role === "인턴") return 0;
  return 1;
}

const ALLOWED_ROLES = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"];

/**
 * user_lawygo.xls 한 행 → site_users + staff 입력용 객체
 * 헤더: 성명, 사용자유형, ID, PW, 업무전화, 내선번호, 업무팩스, 이동전화, 이메일, 소속부서, 입사일, 담당스탭, 비고 ...
 */
function rowToUser(row) {
  const get = (key) => row[key] ?? "";
  const trim = (key) => String(get(key)).trim();
  const 성명 = trim("성명");
  const id = trim("ID");
  if (!id || !성명) return null;
  if (id.toLowerCase() === ADMIN_LOGIN_ID) return null;

  const role = mapRole(get("사용자유형"));
  const effectiveRole = ALLOWED_ROLES.includes(role) ? role : "직원";

  return {
    login_id: id,
    name: 성명,
    role: effectiveRole,
    management_number: id,
    department: trim("소속부서"),
    email: trim("이메일") || null,
    phone: trim("이동전화") || trim("업무전화") || null,
    approval_level: roleToLevel(effectiveRole),
  };
}

async function main() {
  const buf = readFileSync(excelPathResolved);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const headers = (rows[0] || []).filter((h) => h != null && String(h).trim() !== "");
  const dataRows = rows.slice(1);

  const users = [];
  for (const rowArr of dataRows) {
    const row = {};
    (rows[0] || []).forEach((h, i) => {
      if (h != null && String(h).trim() !== "") row[h] = rowArr[i];
    });
    const u = rowToUser(row);
    if (u) users.push(u);
  }

  if (users.length === 0) {
    console.log("삽입할 직원 데이터가 없습니다.");
    process.exit(0);
  }

  const db = createClient(url, serviceKey);
  const password_hash = hashPassword(initialPassword);

  // 1) 관리자 제외 기존 site_users 삭제
  const { data: existingUsers } = await db.from("site_users").select("id, login_id");
  const toDeleteUserIds = (existingUsers || []).filter((r) => r.login_id !== ADMIN_LOGIN_ID).map((r) => r.id);
  if (toDeleteUserIds.length > 0) {
    for (let i = 0; i < toDeleteUserIds.length; i += 100) {
      const chunk = toDeleteUserIds.slice(i, i + 100);
      const { error } = await db.from("site_users").delete().in("id", chunk);
      if (error) {
        console.error("site_users 삭제 실패:", error);
        process.exit(1);
      }
    }
    console.log("기존 회원(관리자 제외)", toDeleteUserIds.length, "명 삭제됨.");
  }

  // 2) 직원(staff) 전부 삭제
  const { data: existingStaff } = await db.from("staff").select("id");
  const staffIds = (existingStaff || []).map((r) => r.id);
  if (staffIds.length > 0) {
    for (let i = 0; i < staffIds.length; i += 100) {
      const chunk = staffIds.slice(i, i + 100);
      const { error } = await db.from("staff").delete().in("id", chunk);
      if (error) {
        console.error("staff 삭제 실패:", error);
        process.exit(1);
      }
    }
    console.log("기존 직원", staffIds.length, "명 삭제됨.");
  }

  // 3) site_users 삽입 (엑셀 행)
  for (const u of users) {
    const { error } = await db.from("site_users").insert({
      login_id: u.login_id,
      password_hash,
      management_number: u.management_number,
      status: "active",
      name: u.name,
      role: u.role,
      approved_at: new Date().toISOString(),
      approved_by: "seed-excel",
    });
    if (error) {
      console.error("site_users 삽입 실패:", u.login_id, error.message);
      process.exit(1);
    }
  }
  console.log("회원(site_users)", users.length, "명 삽입됨. 로그인 ID·비밀번호는 엑셀 ID + 초기비밀번호입니다.");

  // 4) staff 삽입 (엑셀 행)
  const staffRows = users.map((u) => ({
    login_id: u.login_id,
    name: u.name,
    role: u.role,
    department: u.department || "",
    email: u.email,
    phone: u.phone,
    approval_level: u.approval_level,
  }));
  const { error: staffError } = await db.from("staff").insert(staffRows);
  if (staffError) {
    console.error("staff 삽입 실패:", staffError);
    process.exit(1);
  }
  console.log("직원(staff)", staffRows.length, "명 삽입됨.");

  // 5) 관리자(shinkang) staff 행이 없으면 추가 (드롭다운 등에서 관리자 표시용)
  const { data: adminStaff } = await db.from("staff").select("id").eq("login_id", ADMIN_LOGIN_ID).maybeSingle();
  if (!adminStaff) {
    const { data: adminUser } = await db.from("site_users").select("name").eq("login_id", ADMIN_LOGIN_ID).maybeSingle();
    const { error: adminStaffErr } = await db.from("staff").insert({
      login_id: ADMIN_LOGIN_ID,
      name: adminUser?.name || "관리자",
      role: "관리자",
      department: "",
      approval_level: 5,
    });
    if (!adminStaffErr) console.log("관리자 직원 행 추가됨 (login_id: shinkang).");
  }

  if (initialPassword === DEFAULT_INITIAL_PASSWORD) {
    console.log("\n※ 모든 계정 초기 비밀번호: lawygo1! (변경하려면 STAFF_INITIAL_PASSWORD 환경변수로 지정 후 재실행)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
