/**
 * LawBoard 테스트용 사내관리자 계정 생성/갱신
 * 사용: node scripts/seed-lawboard-admin.mjs
 *       LAWBOARD_ADMIN_PASSWORD=비밀번호 node scripts/seed-lawboard-admin.mjs
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { readFileSync, existsSync } from "fs";
import path from "path";

const SALT_LEN = 16;
const KEY_LEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

function hashPassword(plain) {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const hash = crypto.scryptSync(plain, salt, KEY_LEN, SCRYPT_OPTIONS).toString("hex");
  return `${salt}:${hash}`;
}

function loadEnvLocal() {
  const root = path.resolve(process.cwd());
  for (const name of [".env.local", "bot/.env"]) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.LAWBOARD_ADMIN_PASSWORD || "LawBoard2026!";

const LOGIN_ID = process.env.LAWBOARD_ADMIN_LOGIN_ID || "lawboardadmin";
const MANAGEMENT_NUMBER = process.env.LAWBOARD_ADMIN_MN || "10000";
const COMPANY_ADMIN_ROLE_ID = "company_admin";

if (!url || !serviceKey) {
  console.error("오류: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local 또는 bot/.env)");
  process.exit(1);
}

const db = createClient(url, serviceKey);

async function main() {
  const password_hash = hashPassword(password);
  const payload = {
    login_id: LOGIN_ID,
    password_hash,
    management_number: MANAGEMENT_NUMBER,
    name: "LawBoard 관리자",
    role: "관리자",
    permission_role_id: COMPANY_ADMIN_ROLE_ID,
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: "seed-lawboard",
    is_company_founder: false,
  };

  const { data: existing } = await db
    .from("site_users")
    .select("id")
    .eq("login_id", LOGIN_ID)
    .maybeSingle();

  if (existing) {
    const { error } = await db.from("site_users").update(payload).eq("login_id", LOGIN_ID);
    if (error) {
      console.error("업데이트 실패:", error.message);
      process.exit(1);
    }
    console.log("기존 계정 갱신 완료");
  } else {
    const { error } = await db.from("site_users").insert(payload);
    if (error) {
      console.error("생성 실패:", error.message);
      process.exit(1);
    }
    console.log("관리자 계정 생성 완료");
  }

  console.log("\n=== LawBoard 테스트 계정 ===");
  console.log("아이디:", LOGIN_ID);
  console.log("비밀번호:", password);
  console.log("관리번호:", MANAGEMENT_NUMBER);
  console.log("권한: 사내관리자 (company_admin)");
}

main();
