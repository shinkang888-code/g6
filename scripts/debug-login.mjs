/**
 * shinkang 계정 DB 값 및 비밀번호 검증 확인
 * 사용: node scripts/debug-login.mjs
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { readFileSync, existsSync } from "fs";
import path from "path";

const SALT_LEN = 16;
const KEY_LEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

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

function verifyPassword(plain, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(plain, salt, KEY_LEN, SCRYPT_OPTIONS).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

loadEnvLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const db = createClient(url, key);

async function main() {
  const { data: user, error } = await db
    .from("site_users")
    .select("id, login_id, password_hash, management_number, status, name")
    .eq("login_id", "shinkang")
    .maybeSingle();

  if (error) {
    console.error("DB error:", error.message);
    process.exit(1);
  }
  if (!user) {
    console.error("shinkang 계정이 없습니다.");
    process.exit(1);
  }

  console.log("login_id:", JSON.stringify(user.login_id));
  console.log("management_number:", JSON.stringify(user.management_number), "length:", user.management_number?.length);
  console.log("status:", user.status);
  console.log("password_hash (first 30):", (user.password_hash || "").slice(0, 30) + "...");

  const ok = verifyPassword("Admin1234!", user.password_hash);
  console.log("verifyPassword('Admin1234!'):", ok);

  const mgmtMatch = user.management_number === "00000";
  console.log("management_number === '00000':", mgmtMatch);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
