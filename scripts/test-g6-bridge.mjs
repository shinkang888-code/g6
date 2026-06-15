#!/usr/bin/env node
/**
 * G6 ↔ LawyGo 브릿지 API 기능 점검
 * 전제: G6(dev:g6) + LawyGo(dev) 실행, .env.local에 G6 URL·계정 설정
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return {};
  const env = {};
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...process.env, ...loadEnvLocal() };
const LAWYGO = env.LAWYGO_TEST_URL ?? "http://localhost:3000";
const G6_ROOT = (env.NEXT_PUBLIC_GNUBOARD_API_URL ?? "http://localhost:8000")
  .replace(/\/api\/v1\/boards$/i, "")
  .replace(/\/api\/v1$/i, "")
  .replace(/\/api$/i, "")
  .replace(/\/+$/, "");

const results = [];

function parseCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const lines = raw.length ? raw : [res.headers.get("set-cookie")].filter(Boolean);
  return lines.map((c) => String(c).split(";")[0]).join("; ");
}

async function login() {
  const loginId = env.LAWBOARD_ADMIN_LOGIN_ID || "lawboardadmin";
  const password = env.LAWBOARD_ADMIN_PASSWORD || "LawBoard2026!";
  const managementNumber = env.LAWBOARD_ADMIN_MN || "10000";
  const r = await fetch(`${LAWYGO}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password, managementNumber }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `login status ${r.status}`);
  const cookie = parseCookie(r);
  if (!cookie) throw new Error("세션 쿠키 없음");
  return cookie;
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ name, ok: false, error: msg });
    console.error(`✗ ${name}: ${msg}`);
  }
}

async function main() {
  console.log(`LawyGo: ${LAWYGO}`);
  console.log(`G6: ${G6_ROOT}\n`);

  const cookie = await login();
  const authHeaders = { Cookie: cookie, "Content-Type": "application/json" };

  await check("G6 서버 응답", async () => {
    const r = await fetch(G6_ROOT, { redirect: "follow" });
    if (!r.ok && r.status !== 307) throw new Error(`status ${r.status}`);
  });

  await check("LawyGo /api/board 목록", async () => {
    const r = await fetch(`${LAWYGO}/api/board`);
    const j = await r.json();
    if (!j.success) throw new Error(JSON.stringify(j));
  });

  await check("G6 연동 상태 (g6Connected)", async () => {
    const r = await fetch(`${LAWYGO}/api/board`);
    const j = await r.json();
    if (!j.g6Connected) throw new Error("g6Connected=false — NEXT_PUBLIC_GNUBOARD_API_URL 확인");
  });

  const boardId = "notice";
  let postId = null;

  await check(`게시물 작성 (${boardId})`, async () => {
    const r = await fetch(`${LAWYGO}/api/board/${boardId}`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        wr_subject: `[테스트] G6 연동 ${new Date().toISOString()}`,
        wr_content: "LawyGo 브릿지 자동 테스트",
        wr_name: "테스트",
      }),
    });
    const j = await r.json();
    if (!j.success || !j.data?.id) throw new Error(JSON.stringify(j));
    if (j.source !== "g6") {
      const prefer = env.BOARD_BRIDGE_PREFER ?? "hybrid";
      throw new Error(`source=${j.source}, g6 기대 (BOARD_BRIDGE_PREFER=${prefer})`);
    }
    postId = j.data.id;
  });

  await check(`게시물 목록 조회 (${boardId})`, async () => {
    const r = await fetch(`${LAWYGO}/api/board/${boardId}`);
    const j = await r.json();
    if (!j.success) throw new Error(JSON.stringify(j));
    if (!Array.isArray(j.data) || j.data.length === 0) throw new Error("목록 비어 있음");
    if (j.source !== "g6") throw new Error(`source=${j.source}`);
  });

  if (postId) {
    await check(`게시물 단건 조회 (id=${postId})`, async () => {
      const r = await fetch(`${LAWYGO}/api/board/${boardId}/${postId}`);
      const j = await r.json();
      if (!j.success || !j.data) throw new Error(JSON.stringify(j));
    });

    await check(`게시물 삭제 (id=${postId})`, async () => {
      const r = await fetch(`${LAWYGO}/api/board/${boardId}/${postId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const j = await r.json();
      if (!j.success) throw new Error(JSON.stringify(j));
    });
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- 결과: ${passed}/${results.length} 통과 ---`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
