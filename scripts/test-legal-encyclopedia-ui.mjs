/**
 * 로이고 법률백과 — 특허 다면 UI 정적·API 검증
 * node scripts/test-legal-encyclopedia-ui.mjs [--base=URL]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const BASE = (process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ||
  process.env.BASE_URL ||
  "https://lawygo.vercel.app").replace(/\/$/, "");

const errors = [];
function ok(name, cond, msg) {
  if (cond) console.log(`OK: ${name}`);
  else errors.push(msg || name);
}

// --- 정적: 특허 다면 UI 컴포넌트 ---
const workspace = readFileSync(resolve(root, "src/components/board/ai/LegalEncyclopediaWorkspace.tsx"), "utf8");
const canvas = readFileSync(resolve(root, "src/components/board/ai/encyclopedia/PatentMultiFaceCanvas.tsx"), "utf8");
const frame = readFileSync(resolve(root, "src/components/board/ai/encyclopedia/PatentFramePanel.tsx"), "utf8");
const rank = readFileSync(resolve(root, "src/components/board/ai/encyclopedia/EncyclopediaRankStrip.tsx"), "utf8");
const globals = readFileSync(resolve(root, "src/app/globals.css"), "utf8");
const dock = readFileSync(resolve(root, "src/components/board/ai/encyclopedia/FeatureDock.tsx"), "utf8");

ok("PatentMultiFaceCanvas", canvas.includes("PatentMultiFaceCanvas"));
ok("PatentFramePanel 연동", workspace.includes("PatentMultiFaceCanvas"));
ok("EncyclopediaRankStrip", workspace.includes("EncyclopediaRankStrip"));
ok("110 검색 프레임", workspace.includes("110"));
ok("프레임별 스크롤", frame.includes("overflow-y-auto") && frame.includes("ChevronUp"));
ok("가로 스크롤 캔버스", canvas.includes("overflow-auto") || canvas.includes("overflow-x-auto"));
ok("모바일 탭", canvas.includes("mobileFace"));
ok("하단 순위 스트립", rank.includes("overflow-x-auto"));
ok("patent-frame-scroll CSS", globals.includes("patent-frame-scroll"));
ok("프로젝트 종류프레임", workspace.includes('layout="stacked"'));
ok("AI 특허 정보", workspace.includes("다면적 프레임 UI"));
ok("기능독 기본 최소화", dock.includes("useState(false)"));

console.log(`\nAPI E2E: ${BASE}`);
const demo = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
let cookie = "";
for (const c of demo.headers.getSetCookie?.() ?? []) {
  const p = c.split(";")[0];
  if (p.startsWith("lawygo_session=")) cookie = p;
}
ok("데모 로그인", demo.ok, `demo ${demo.status}`);

const searchRes = await fetch(`${BASE}/api/ai/legal-encyclopedia`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({ action: "search", keyword: "하자보수", category: "전체" }),
});
const searchJson = await searchRes.json().catch(() => ({}));
ok("search API 200", searchRes.ok, searchJson.error);
ok("documents 배열", Array.isArray(searchJson.documents), "documents 없음");
ok("pipeline 단계", Array.isArray(searchJson.pipeline) && searchJson.pipeline.length >= 5, "pipeline 부족");
if (searchJson.documents?.length) {
  ok("순위점수", typeof searchJson.documents[0].rankingScore === "number", "rankingScore 없음");
}

const pageRes = await fetch(`${BASE}/board/ai/legal_encyclopedia`, { redirect: "follow" });
const html = await pageRes.text();
ok("법률백과 페이지 200", pageRes.ok);
ok("페이지 런타임 에러 없음", !/Application error|Internal Server Error/i.test(html));

const bannerRes = await fetch(`${BASE}/api/banners?placement=legal_encyclopedia`);
ok("광고 배너 API", bannerRes.ok);

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}
console.log("\n모든 검증 통과");
