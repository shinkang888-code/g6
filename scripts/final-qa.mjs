/**
 * LawyGo 최종 검수 — AI·데이터 연동 집중
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE = (process.env.BASE_URL || "https://lawygo.vercel.app").replace(/\/$/, "");

/** @type {{ category: string; name: string; method: string; path: string; body?: unknown; expectStatus?: number[]; check?: (d: unknown) => string | null; needsAuth?: boolean }[]} */
const tests = [
  { category: "인증", name: "auth/status", method: "GET", path: "/api/auth/status", expectStatus: [200] },
  { category: "인증", name: "auth/demo", method: "POST", path: "/api/auth/demo", expectStatus: [200], needsAuth: true },
  { category: "인증", name: "auth/session", method: "GET", path: "/api/auth/session", expectStatus: [200], afterDemo: true },
  { category: "Gemini", name: "gemini GET (설정)", method: "GET", path: "/api/ai/gemini", expectStatus: [200],
    check: (d) => {
      const j = /** @type {{ configured?: boolean; models?: string[] }} */ (d);
      if (typeof j.configured !== "boolean") return "configured 필드 없음";
      if (!Array.isArray(j.models) || j.models.length === 0) return "models 배열 없음";
      return null;
    },
  },
  { category: "Gemini", name: "gemini POST (빈 prompt)", method: "POST", path: "/api/ai/gemini", body: {}, expectStatus: [400, 401], afterDemo: true },
  { category: "법률백과", name: "legal-encyclopedia GET", method: "GET", path: "/api/ai/legal-encyclopedia", expectStatus: [200, 401], afterDemo: true,
    check: (d) => {
      const j = /** @type {{ dbReady?: boolean; stats?: unknown }} */ (d);
      if (j.dbReady === undefined && !j.stats) return "dbReady/stats 없음";
      return null;
    },
  },
  { category: "법률백과", name: "legal-encyclopedia search", method: "POST", path: "/api/ai/legal-encyclopedia",
    body: { action: "search", keyword: "손해배상", category: "전체" },
    expectStatus: [200, 401, 503], afterDemo: true,
    check: (d) => {
      const j = /** @type {{ documents?: unknown[]; error?: string }} */ (d);
      if (j.error) return null;
      if (!Array.isArray(j.documents)) return "documents 배열 없음";
      return null;
    },
  },
  { category: "법률백과", name: "document-view (키 없음)", method: "POST", path: "/api/encyclopedia/document-view",
    body: {}, expectStatus: [400, 401], afterDemo: true },
  { category: "배ner", name: "banners GET", method: "GET", path: "/api/banners?placement=legal_encyclopedia", expectStatus: [200] },
  { category: "데이터", name: "cases 목록", method: "GET", path: "/api/admin/cases?page=1&page_size=5", expectStatus: [200, 503], afterDemo: true },
  { category: "데이터", name: "deadlines", method: "GET", path: "/api/deadlines", expectStatus: [200, 503], afterDemo: true },
  { category: "데이터", name: "clients", method: "GET", path: "/api/admin/clients?page=1&page_size=5", expectStatus: [200, 503], afterDemo: true },
  { category: "데이터", name: "staff", method: "GET", path: "/api/staff", expectStatus: [200, 503], afterDemo: true },
  { category: "데이터", name: "finance", method: "GET", path: "/api/finance?sync=0", expectStatus: [200, 503], afterDemo: true },
  { category: "데이터", name: "notices", method: "GET", path: "/api/notices?page=1&page_size=5", expectStatus: [200] },
  { category: "페이지", name: "/board/ai/legal_encyclopedia", method: "GET", path: "/board/ai/legal_encyclopedia", expectStatus: [200], isPage: true },
  { category: "페이지", name: "/admin/banners", method: "GET", path: "/admin/banners", expectStatus: [200], isPage: true },
  { category: "페이지", name: "/admin/settings/ai", method: "GET", path: "/admin/settings/ai", expectStatus: [200], isPage: true },
];

let cookie = "";
let demoLoggedIn = false;

async function fetchTest(t) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const url = `${BASE}${t.path}`;
  const res = await fetch(url, {
    method: t.method,
    headers,
    body: t.body !== undefined ? JSON.stringify(t.body) : undefined,
    redirect: t.isPage ? "follow" : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const part = c.split(";")[0];
    if (part.startsWith("lawygo_session=")) cookie = part;
  }
  const legacy = res.headers.get("set-cookie");
  if (legacy?.includes("lawygo_session=")) cookie = legacy.split(";")[0];

  if (t.isPage) {
    const html = await res.text();
    const hasErr = /Application error|Internal Server Error|Unhandled Runtime Error/i.test(html);
    return { res, data: { html: html.slice(0, 200) }, hasErr };
  }
  const data = await res.json().catch(() => ({}));
  return { res, data, hasErr: false };
}

/** @type {{ category: string; name: string; status: string; detail: string }[]} */
const results = [];

async function run() {
  console.log(`LawyGo 최종 검수 (${BASE})\n`);

  for (const t of tests) {
    if (t.needsAuth && !demoLoggedIn) {
      const login = tests.find((x) => x.path === "/api/auth/demo");
      if (login) {
        const { res } = await fetchTest(login);
        demoLoggedIn = res.ok;
      }
    }

    try {
      const { res, data, hasErr } = await fetchTest(t);
      const expect = t.expectStatus ?? [200];
      if (t.isPage && hasErr) {
        results.push({ category: t.category, name: t.name, status: "FAIL", detail: "런타임 에러" });
        continue;
      }
      if (!expect.includes(res.status)) {
        const err = /** @type {{ error?: string }} */ (data).error ?? JSON.stringify(data).slice(0, 100);
        results.push({ category: t.category, name: t.name, status: "FAIL", detail: `HTTP ${res.status}: ${err}` });
        continue;
      }
      const checkErr = t.check?.(data) ?? null;
      if (checkErr) {
        results.push({ category: t.category, name: t.name, status: "FAIL", detail: checkErr });
      } else {
        results.push({ category: t.category, name: t.name, status: "PASS", detail: `HTTP ${res.status}` });
      }
    } catch (e) {
      results.push({ category: t.category, name: t.name, status: "FAIL", detail: e instanceof Error ? e.message : String(e) });
    }
  }

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  console.log(`PASS ${pass} / FAIL ${fail}\n`);
  for (const r of results) {
    console.log(`${r.status === "PASS" ? "✓" : "✗"} [${r.category}] ${r.name} — ${r.detail}`);
  }

  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "qa");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "final-qa-results.json"),
    JSON.stringify({ base: BASE, at: new Date().toISOString(), pass, fail, results }, null, 2)
  );
  console.log(`\n결과 저장: docs/qa/final-qa-results.json`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
