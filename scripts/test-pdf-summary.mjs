/**
 * 판결문 PDF·이미지 OCR 요약 검증
 * node scripts/test-pdf-summary.mjs [pdf-path]
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const BASE = process.argv[3] ?? process.env.BASE_URL ?? "http://localhost:3000";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseStructuredSummary(summary, sectionTitles) {
  const result = {};
  for (let i = 0; i < sectionTitles.length; i++) {
    const title = sectionTitles[i];
    const escaped = escapeRegex(title);
    const nextEscaped = sectionTitles
      .slice(i + 1)
      .map((t) => escapeRegex(t))
      .join("|");
    const boundary = nextEscaped
      ? `(?=(?:\\d+[.)]?\\s*)?(?:${nextEscaped})\\s*[\\n:：]|$)`
      : "$";
    const re = new RegExp(
      `(?:\\d+[.)]?\\s*)?${escaped}\\s*[\\n:：]?\\s*([\\s\\S]*?)${boundary}`,
      "i"
    );
    const match = summary.match(re);
    result[title] = match?.[1]?.trim() ?? "";
  }
  return result;
}

function analyzeJudgmentStructure(text) {
  const markers = ["주문", "주 문", "범죄사실", "이유", "판단", "주장의 요지"];
  return markers.filter((m) => text.includes(m));
}

function needsOcrFallback(extracted, pageCount) {
  const len = extracted.trim().length;
  if (len < 60) return true;
  if (pageCount > 0 && len / pageCount < 40) return true;
  return false;
}

const sections = [
  "사건의 개요",
  "주요 쟁점",
  "법원의 판단 (인용/기각 사유)",
  "결론 (주문)",
  "실무적 시사점",
];

const mockSummary = `1) 사건의 개요
피고인은 투자 사기 혐의로 기소되었다.

2) 주요 쟁점
피고인은 고의가 없었다고 주장한다.

3) 법원의 판단 (인용/기각 사유)
법원은 피고인의 주장을 배척하였다.

4) 결론 (주문)
피고인을 징역 1년에 처한다.

5) 실무적 시사점
투자 권유 시 고지 의무를 명확히 해야 한다.`;

const parsed = parseStructuredSummary(mockSummary, sections);
let passed = 0;
let failed = 0;

function assert(name, cond) {
  if (cond) {
    console.log(`  OK  ${name}`);
    passed++;
  } else {
    console.log(`  FAIL ${name}`);
    failed++;
  }
}

console.log("=== 구조 분석 마커 ===");
const sampleText = "주문\n피고인을 징역 1년에 처한다.\n\n이유\n범죄사실\n피고인은...";
const markers = analyzeJudgmentStructure(sampleText);
assert("주문·이유·범죄사실 감지", markers.includes("주문") && markers.includes("이유") && markers.includes("범죄사실"));

console.log("\n=== OCR 폴백 판단 ===");
assert("짧은 텍스트 → OCR", needsOcrFallback("짧음", 1));
assert("충분한 텍스트 → pdf-text", !needsOcrFallback("a".repeat(200), 2));

console.log("\n=== 요약 섹션 파싱 ===");
assert("사건의 개요", parsed["사건의 개요"].includes("투자 사기"));
assert("주요 쟁점", parsed["주요 쟁점"].includes("고의"));
assert("법원의 판단", parsed["법원의 판단 (인용/기각 사유)"].includes("배척"));
assert("결론 (주문)", parsed["결론 (주문)"].includes("징역 1년"));
assert("실무적 시사점", parsed["실무적 시사점"].includes("고지 의무"));

console.log("\n=== 파일·UI 점검 ===");
const ui = readFileSync(join(root, "src/components/board/ai/PdfSummaryTab.tsx"), "utf8");
assert("PDF·이미지 업로드 문구", ui.includes("PDF·이미지"));
assert("OCR API 연동", ui.includes("/api/document/ocr"));
assert("DOCUMENT_ACCEPT", ui.includes("DOCUMENT_ACCEPT"));

const ocrRoute = join(root, "src/app/api/document/ocr/route.ts");
assert("OCR API 존재", existsSync(ocrRoute));
const ocrLib = readFileSync(join(root, "src/lib/documentOcr/extractDocumentText.ts"), "utf8");
assert("Vision/CLOVA/Gemini 체인", ocrLib.includes("runDocumentOcrChain"));

console.log("\n=== PDF 텍스트 추출 (pdfjs) ===");
const samplePdf = process.argv[2];
if (samplePdf && existsSync(samplePdf)) {
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(readFileSync(samplePdf));
    const pdf = await getDocument({ data }).promise;
    const parts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    const text = parts.join("\n").trim();
    assert(`PDF 추출 (${text.length}자)`, text.length > 20);
    console.log(`  샘플: ${text.slice(0, 120).replace(/\s+/g, " ")}…`);
    console.log(`  OCR 필요: ${needsOcrFallback(text, pdf.numPages)}`);
  } catch (e) {
    console.log(`  SKIP PDF 추출: ${e.message}`);
  }
} else {
  console.log("  SKIP PDF 파일 없음 (사용: node scripts/test-pdf-summary.mjs path/to/file.pdf)");
}

console.log("\n=== API (선택) ===");
try {
  const anon = await fetch(`${BASE}/api/document/ocr`);
  assert("OCR API 비로그인 차단", anon.status === 401 || anon.status === 403);
  const auth = await fetch(`${BASE}/api/auth/demo`, { method: "POST" });
  const cookie = (auth.headers.get("set-cookie") ?? "").split(";")[0];
  if (cookie) {
    const info = await fetch(`${BASE}/api/document/ocr`, { headers: { Cookie: cookie } });
    assert("OCR info GET 200", info.status === 200);
  } else {
    console.log("  SKIP API (데모 로그인 실패)");
  }
} catch {
  console.log("  SKIP API (서버 미실행)");
}

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
