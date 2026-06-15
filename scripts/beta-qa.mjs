/**
 * LawyGo 베타 기능 검수 스모크 테스트
 * 사용: node scripts/beta-qa.mjs
 *       BASE_URL=https://lawygo.vercel.app node scripts/beta-qa.mjs
 */

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

/** @type {{ name: string; method: string; path: string; expectStatus?: number[]; body?: unknown; check?: (data: unknown, res: Response) => string | null }[]} */
const tests = [
  { name: "인증 상태", method: "GET", path: "/api/auth/status", expectStatus: [200] },
  { name: "데모 로그인", method: "POST", path: "/api/auth/demo", expectStatus: [200], auth: true },
  { name: "세션 확인", method: "GET", path: "/api/auth/me", expectStatus: [200, 401], afterAuth: true },
  { name: "메뉴 목록", method: "GET", path: "/api/menus", expectStatus: [200] },
  { name: "사건 목록(페이지1)", method: "GET", path: "/api/admin/cases?page=1&page_size=20", expectStatus: [200, 503], afterAuth: true,
    check: (data) => {
      const d = /** @type {{ data?: unknown[]; total?: number; error?: string }} */ (data);
      if (d.error) return null;
      if (!Array.isArray(d.data)) return "data 배열 없음";
      if (typeof d.total !== "number") return "total 숫자 없음";
      if (d.data.length > 20) return `페이지당 20건 초과: ${d.data.length}건`;
      return null;
    },
  },
  { name: "사건 목록(진행중 필터)", method: "GET", path: "/api/admin/cases?page=1&page_size=20&status=진행중", expectStatus: [200, 503], afterAuth: true,
    check: (data) => {
      const d = /** @type {{ data?: { status?: string }[]; total?: number; error?: string }} */ (data);
      if (d.error) return null;
      const bad = (d.data ?? []).filter((c) => c.status !== "진행중");
      if (bad.length) return `진행중 필터 무시: ${bad.length}건`;
      return null;
    },
  },
  { name: "기일 목록", method: "GET", path: "/api/deadlines", expectStatus: [200, 503], afterAuth: true },
  { name: "직원 목록", method: "GET", path: "/api/staff", expectStatus: [200, 503], afterAuth: true },
  { name: "고객 목록", method: "GET", path: "/api/admin/clients", expectStatus: [200, 503], afterAuth: true },
  { name: "회원 목록(관리자)", method: "GET", path: "/api/admin/members", expectStatus: [200, 503], afterAuth: true },
  { name: "게시판 목록", method: "GET", path: "/api/board", expectStatus: [200] },
  { name: "시스템 설정", method: "GET", path: "/api/admin/settings", expectStatus: [200, 503], afterAuth: true },
  { name: "대법원 사건검색 API(빈요청)", method: "POST", path: "/api/court-case", expectStatus: [400, 401, 503], afterAuth: true,
    body: {},
  },
];

/** @type {string[]} */
const pageRoutes = [
  "/",
  "/cases",
  "/calendar",
  "/approval",
  "/finance",
  "/stats",
  "/staff",
  "/clients",
  "/consultation",
  "/board",
  "/messenger",
  "/notifications",
  "/settings",
  "/admin",
  "/login",
];

let cookie = "";

async function fetchJson(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const part = c.split(";")[0];
    if (part.startsWith("lawygo_session=")) cookie = part;
  }
  const legacy = res.headers.get("set-cookie");
  if (legacy && legacy.includes("lawygo_session=")) {
    cookie = legacy.split(";")[0];
  }
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function okStatus(res, expect) {
  return (expect ?? [200]).includes(res.status);
}

async function runApiTests() {
  console.log(`\n=== API 검수 (${BASE}) ===\n`);
  /** @type {{ name: string; status: string; detail?: string }[]} */
  const results = [];

  for (const t of tests) {
    if (t.auth && !cookie) {
      const { res, data } = await fetchJson("POST", "/api/auth/demo");
      if (!res.ok) {
        results.push({ name: t.name, status: "SKIP", detail: `데모 로그인 실패: ${res.status} ${data.error ?? ""}` });
        continue;
      }
    }
    try {
      const { res, data } = await fetchJson(t.method, t.path, t.body);
      const expect = t.expectStatus ?? [200];
      if (!okStatus(res, expect)) {
        results.push({
          name: t.name,
          status: "FAIL",
          detail: `HTTP ${res.status} (기대: ${expect.join("|")}) ${data.error ?? JSON.stringify(data).slice(0, 120)}`,
        });
        continue;
      }
      const checkErr = t.check?.(data, res) ?? null;
      if (checkErr) {
        results.push({ name: t.name, status: "FAIL", detail: checkErr });
      } else {
        results.push({ name: t.name, status: "PASS", detail: `HTTP ${res.status}` });
      }
    } catch (e) {
      results.push({ name: t.name, status: "FAIL", detail: e instanceof Error ? e.message : String(e) });
    }
  }

  return results;
}

async function runPageTests() {
  console.log(`\n=== 페이지 렌더 검수 (${BASE}) ===\n`);
  /** @type {{ name: string; status: string; detail?: string }[]} */
  const results = [];
  for (const path of pageRoutes) {
    try {
      const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
      const html = await res.text();
      const hasError = /Application error|Internal Server Error|Unhandled Runtime Error/i.test(html);
      if (!res.ok || hasError) {
        results.push({ name: path, status: "FAIL", detail: `HTTP ${res.status}${hasError ? " + 런타임 에러" : ""}` });
      } else {
        results.push({ name: path, status: "PASS", detail: `HTTP ${res.status}` });
      }
    } catch (e) {
      results.push({ name: path, status: "FAIL", detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

function printResults(title, results) {
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skip = results.filter((r) => r.status === "SKIP").length;
  console.log(`--- ${title}: PASS ${pass} / FAIL ${fail} / SKIP ${skip} ---`);
  for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : r.status === "SKIP" ? "○" : "✗";
    console.log(`  ${icon} [${r.status}] ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  return fail;
}

async function main() {
  console.log("LawyGo 베타 검수 시작...");
  let totalFail = 0;
  const apiResults = await runApiTests();
  totalFail += printResults("API", apiResults);
  const pageResults = await runPageTests();
  totalFail += printResults("페이지", pageResults);
  console.log(`\n총 실패: ${totalFail}`);
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
