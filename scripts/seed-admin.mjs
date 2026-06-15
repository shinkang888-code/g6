/**
 * 관리자 계정 shinkang 생성 (최초 1회 실행)
 * 사용: ADMIN_INITIAL_PASSWORD=비밀번호 node scripts/seed-admin.mjs
 * .env.local 이 있으면 자동으로 로드합니다.
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
const password = process.env.ADMIN_INITIAL_PASSWORD;

if (!url || !serviceKey) {
  console.error("오류: .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 설정하세요.");
  process.exit(1);
}
if (!password) {
  console.error("오류: ADMIN_INITIAL_PASSWORD 환경 변수를 설정하세요. 예: ADMIN_INITIAL_PASSWORD=비밀번호 node scripts/seed-admin.mjs");
  process.exit(1);
}

const ADMIN_LOGIN_ID = "shinkang";
const PLATFORM_ADMIN_ROLE_ID = "platform_admin";
const db = createClient(url, serviceKey);

async function main() {
  const { data: existing } = await db.from("site_users").select("id, status").eq("login_id", ADMIN_LOGIN_ID).single();

  const password_hash = hashPassword(password);
  const payload = {
    login_id: ADMIN_LOGIN_ID,
    password_hash,
    management_number: process.env.ADMIN_MANAGEMENT_NUMBER || "00000",
    name: process.env.ADMIN_NAME || "전체관리자",
    role: "관리자",
    permission_role_id: process.env.PERMISSION_ROLE_ID || PLATFORM_ADMIN_ROLE_ID,
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: "seed",
  };

  if (existing) {
    const { error } = await db.from("site_users").update({
      password_hash: payload.password_hash,
      management_number: payload.management_number,
      name: payload.name,
      role: payload.role,
      permission_role_id: payload.permission_role_id,
      status: "approved",
      approved_at: payload.approved_at,
      approved_by: payload.approved_by,
    }).eq("login_id", ADMIN_LOGIN_ID);
    if (error) {
      console.error("업데이트 실패:", error.message);
      process.exit(1);
    }
    console.log("기존 shinkang 계정을 업데이트했습니다. 새 비밀번호로 로그인하세요.");
  } else {
    const { error } = await db.from("site_users").insert(payload).select("id").single();
    if (error) {
      console.error("삽입 실패:", error.message);
      process.exit(1);
    }
    console.log("관리자 계정이 생성되었습니다. 로그인 ID: shinkang");
  }
}

main();
