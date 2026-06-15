/**
 * 직원관리 전체 삭제 후, 지정한 회원목록(승인 완료 61명)을 직원(staff) 테이블에 이식
 * 사용: node scripts/seed-staff-from-members.mjs  또는  npm run seed-staff
 * .env.local 을 자동 로드합니다.
 * 사전: Supabase에 staff 테이블이 있어야 함 (supabase/migrations 적용 또는 대시보드에서 테이블 생성).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import path from "path";

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

function roleToLevel(role) {
  if (!role || role === "-") return 1;
  if (role === "임원") return 5;
  if (role === "변호사") return 3;
  if (role === "사무장" || role === "국장") return 2;
  if (role === "인턴") return 0;
  return 1;
}

const ALLOWED_ROLES = ["관리자", "임원", "변호사", "사무장", "국장", "직원", "사무원", "인턴"];

// 승인 완료 61명: 아이디, 이름, 권한(직급), 관리번호
const MEMBERS = [
  ["staff50", "강준철", "관리자", "00000"],
  ["staff49", "임민서", "인턴", "00000"],
  ["staff48", "장서현", "사무원", "00000"],
  ["staff47", "윤동현", "사무원", "00000"],
  ["staff46", "조수진", "직원", "00000"],
  ["staff45", "강영호", "국장", "00000"],
  ["staff44", "정지아", "사무장", "00000"],
  ["staff43", "최승민", "변호사", "00000"],
  ["staff42", "박다은", "변호사", "00000"],
  ["staff41", "이태현", "변호사", "00000"],
  ["staff40", "김미래", "임원", "00000"],
  ["staff39", "홍재현", "인턴", "00000"],
  ["staff38", "류소희", "사무원", "00000"],
  ["staff37", "송현우", "사무원", "00000"],
  ["staff36", "안유나", "직원", "00000"],
  ["staff35", "황성민", "국장", "00000"],
  ["staff34", "권예진", "사무장", "00000"],
  ["staff33", "신준호", "변호사", "00000"],
  ["staff32", "서지유", "변호사", "00000"],
  ["staff31", "오시우", "변호사", "00000"],
  ["staff30", "한하은", "임원", "00000"],
  ["staff29", "임도윤", "인턴", "00000"],
  ["staff28", "장수아", "사무원", "00000"],
  ["staff27", "윤지훈", "사무원", "00000"],
  ["staff26", "조서연", "직원", "00000"],
  ["staff25", "강민준", "국장", "00000"],
  ["staff24", "정민서", "사무장", "00000"],
  ["staff23", "최서현", "변호사", "00000"],
  ["staff22", "박동현", "변호사", "00000"],
  ["staff21", "이수진", "변호사", "00000"],
  ["staff20", "김영호", "임원", "00000"],
  ["staff19", "홍지아", "인턴", "00000"],
  ["staff18", "류승민", "사무원", "00000"],
  ["staff17", "송다은", "사무원", "00000"],
  ["staff16", "안태현", "직원", "00000"],
  ["staff15", "황미래", "국장", "00000"],
  ["staff14", "권재현", "사무장", "00000"],
  ["staff13", "신소희", "변호사", "00000"],
  ["staff12", "서현우", "변호사", "00000"],
  ["staff11", "오유나", "변호사", "00000"],
  ["staff10", "한성민", "임원", "00000"],
  ["staff9", "임예진", "인턴", "00000"],
  ["staff8", "장준호", "사무원", "00000"],
  ["staff7", "윤지유", "사무원", "00000"],
  ["staff6", "조시우", "직원", "00000"],
  ["staff5", "강하은", "국장", "00000"],
  ["staff4", "정도윤", "사무장", "00000"],
  ["staff3", "최수아", "변호사", "00000"],
  ["staff2", "박지훈", "변호사", "00000"],
  ["staff1", "이서연", "변호사", "00000"],
  ["iso", "강이소", "인턴", "00000"],
  ["sukyung", "정수경", "사무원", "00000"],
  ["yeonjin", "최연진", "사무원", "00000"],
  ["jihoon", "박지훈", "사무장", "00000"],
  ["seoyeon", "이서연", "변호사", "00000"],
  ["minjun", "김민준", "변호사", "00000"],
  ["sk888", "강준철관리", "관리자", "00000"],
  ["sk88", "강준철", "관리자", "staff-sk88"],
  ["testauth-1772884738949", "테스트", "직원", "00000"],
  ["sk", "강준철", "직원", "00000"],
  ["shinkang", "관리자", "사무장", "00000"],
];

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("오류: .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 설정하세요.");
  process.exit(1);
}

const db = createClient(url, serviceKey);

async function main() {
  console.log("직원(staff) 테이블 전체 삭제 중...");
  const { data: existing } = await db.from("staff").select("id");
  if (existing?.length) {
    const ids = existing.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error: delError } = await db.from("staff").delete().in("id", chunk);
      if (delError) {
        console.error("삭제 실패:", delError.message);
        process.exit(1);
      }
    }
  }
  console.log("삭제 완료. 직원 61명 삽입 중...");

  const rows = MEMBERS.map(([loginId, name, role, managementNumber]) => {
    const r = role && role !== "-" && ALLOWED_ROLES.includes(role) ? role : "직원";
    return {
      login_id: loginId,
      name: name || loginId,
      role: r,
      department: "",
      email: null,
      phone: null,
      approval_level: roleToLevel(r),
    };
  });

  const { data, error } = await db.from("staff").insert(rows).select("id");
  if (error) {
    console.error("삽입 실패:", error.message);
    process.exit(1);
  }
  console.log("완료: 직원", data?.length ?? rows.length, "명이 직원관리에 반영되었습니다.");
}

main();
