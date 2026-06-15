/**
 * 법령 조문 뷰어 API·URL 검증
 * node scripts/test-law-article-api.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

function formatLawJoCode(articleNo, articleSub) {
  const main = String(articleNo).replace(/\D/g, "");
  const sub = articleSub != null ? String(articleSub).replace(/\D/g, "") : "0";
  return `00${main.padStart(2, "0")}${sub.padStart(2, "0")}`;
}

function buildLawScEmbedUrl(lawName, articleNo, articleSub) {
  const jo = articleSub ? `제${articleNo}조의${articleSub}` : `제${articleNo}조`;
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=0&subMenu=1&tabMenuId=81&query=${encodeURIComponent(`${lawName.trim()} ${jo}`)}`;
}

assert(formatLawJoCode(2) === "000200", "JO 제2조");
assert(formatLawJoCode(10, 2) === "001002", "JO 제10조의2");
assert(formatLawJoCode(24) === "002400", "JO 제24조");

const embed = buildLawScEmbedUrl("건축법", 24);
assert(embed.includes("lsSc.do"), "embed uses lsSc");
assert(!embed.includes("lsLinkCommonInfo"), "broken lsLink removed");
assert(embed.includes(encodeURIComponent("건축법 제24조")), "query encoded");

const lawLinks = readFileSync(resolve(root, "src/lib/lawLinks.ts"), "utf8");
assert(lawLinks.includes("buildLawScEmbedUrl"), "lawLinks uses embed url");
assert(readFileSync(resolve(root, "src/components/board/ai/LawArticleViewer.tsx"), "utf8").includes("/api/law/article"), "viewer uses API");

console.log("=== 법령 조문 뷰어 정적 점검 ===");
if (errors.length) {
  errors.forEach((e) => console.error("FAIL:", e));
  process.exit(1);
}
console.log("정적 점검 통과");

async function resolveBaseUrl() {
  for (const url of ["http://localhost:3001", "http://localhost:3000"]) {
    try {
      const r = await fetch(`${url}/api/auth/status`, { signal: AbortSignal.timeout(2000) });
      if (r.ok || r.status === 401) return url;
    } catch {
      /* next */
    }
  }
  throw new Error("dev server not running");
}

try {
  const base = await resolveBaseUrl();
  const res = await fetch(`${base}/api/law/article?law=${encodeURIComponent("건축법")}&articleNo=24`);
  const json = await res.json();
  assert(res.ok, `API HTTP ${res.status}: ${json.error ?? ""}`);
  assert(json.embedUrl?.includes("lsSc.do"), "embedUrl");
  assert(json.externalUrl, "externalUrl");
  console.log(`OK: source=${json.source} embed=${json.embedUrl?.slice(0, 60)}...`);

  const bad = await fetch(
    "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&urlMode=lsStmd&query=" +
      encodeURIComponent("건축법 제24조")
  );
  const badText = await bad.text();
  assert(badText.includes("비정상"), "old lsLink is blocked");

  const good = await fetch(json.embedUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const goodText = await good.text();
  assert(goodText.length > 10000 && !goodText.includes("비정상"), "lsSc embed url loads");
  console.log("OK: lsSc 페이지 로드", goodText.length, "bytes");
} catch (e) {
  console.error("FAIL:", e.message ?? e);
  process.exit(1);
}

console.log("모든 점검 완료");
