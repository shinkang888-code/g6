/**
 * 국가법령정보 웹 조문 추출 검증
 * node scripts/test-law-web-scrape.mjs
 */

const UA = "Mozilla/5.0 (compatible; LawyGo/1.0)";

function formatLawJoCode(articleNo, articleSub) {
  const main = String(articleNo).replace(/\D/g, "");
  const sub = articleSub != null ? String(articleSub).replace(/\D/g, "") : "0";
  return `00${main.padStart(2, "0")}${sub.padStart(2, "0")}`;
}

function buildArticleMarker(articleNo, articleSub) {
  const main = String(articleNo).replace(/\D/g, "");
  const sub = articleSub?.replace(/\D/g, "") || "0";
  const joCode = formatLawJoCode(articleNo, articleSub);
  return `value="${main}:${sub}:${joCode}:`;
}

function extractText(html, articleNo, articleSub) {
  const marker = buildArticleMarker(articleNo, articleSub);
  const markerIdx = html.indexOf(marker);
  if (markerIdx < 0) return "";
  const start = html.lastIndexOf("<p", markerIdx);
  const main = parseInt(String(articleNo).replace(/\D/g, ""), 10);
  const nextMarker = buildArticleMarker(String(main + 1));
  const nextIdx = html.indexOf(nextMarker, markerIdx + marker.length);
  const anchorIdx = html.indexOf(`name="J${main + 1}:0"`, markerIdx);
  const candidates = [nextIdx, anchorIdx].filter((n) => n > markerIdx);
  const end = candidates.length ? Math.min(...candidates) : html.length;
  return html
    .slice(start, end)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveLawPageMeta(lawName) {
  const url = `https://www.law.go.kr/${encodeURIComponent("법령")}/${encodeURIComponent(lawName.trim())}`;
  const html = await fetch(url, { headers: { "User-Agent": UA } }).then((r) => r.text());
  const m = html.match(/lsInfoP\.do\?([^"'>\s]+)/i);
  if (!m) return null;
  const params = new URLSearchParams(m[1].replace(/&amp;/g, "&"));
  const lsiSeq = params.get("lsiSeq");
  const efYd = params.get("efYd");
  if (!lsiSeq || !efYd) return null;
  return { lsiSeq, efYd, chrClsCd: params.get("chrClsCd") ?? "010202" };
}

const meta = await resolveLawPageMeta("건축법");
if (!meta) throw new Error("meta resolve failed");
console.log("OK: meta", meta);

const bodyUrl = `https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=${meta.lsiSeq}&chrClsCd=${meta.chrClsCd}&urlMode=lsInfoP&viewCls=lsInfoP&efYd=${meta.efYd}&ancYnChk=0`;
const body = await fetch(bodyUrl, { headers: { "User-Agent": UA } }).then((r) => r.text());
const text = extractText(body, "30");
if (!text.includes("건축통계")) throw new Error(`wrong article: ${text.slice(0, 80)}`);
if (!text.includes("제30조")) throw new Error("제30조 missing");
console.log("OK:", text.slice(0, 120));
