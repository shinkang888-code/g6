/**
 * 서버 PDF 텍스트 추출 (pdfjs + DOMMatrix polyfill) 검증
 * node scripts/test-pdf-text-extract.mjs
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

class DOMMatrixPolyfill {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  constructor(init) {
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }
  multiply() {
    return this;
  }
  inverse() {
    return this;
  }
  translate() {
    return this;
  }
  scale() {
    return this;
  }
  rotate() {
    return this;
  }
  transformPoint(p) {
    return p;
  }
  static fromMatrix() {
    return new DOMMatrixPolyfill();
  }
}

if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sample = resolve(root, "scripts/fixtures/sample-judgment.pdf");

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
).href;

const buf = readFileSync(sample);
const pdf = await pdfjs.getDocument({
  data: new Uint8Array(buf),
  useSystemFonts: true,
  useWorkerFetch: false,
  isEvalSupported: false,
}).promise;

const page = await pdf.getPage(1);
const textContent = await page.getTextContent();
const text = textContent.items
  .map((item) => (item && typeof item === "object" && "str" in item ? item.str : ""))
  .join(" ")
  .trim();

if (pdf.numPages < 1) throw new Error("page count");
if (textContent.items.length < 1) throw new Error("no text items");

console.log("PDF 텍스트 추출 검증 통과", { pages: pdf.numPages, chars: text.length, preview: text.slice(0, 40) });
