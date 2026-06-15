/**
 * 서버 측 PDF 텍스트 추출 (pdfjs-dist)
 */
import { configurePdfjsWorker, ensurePdfjsNodePolyfills } from "@/lib/documentOcr/pdfjsNodePolyfill";
import { normalizeJudgmentText } from "@/lib/pdfTextExtract";

export async function extractTextFromPdfBufferServer(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
}> {
  ensurePdfjsNodePolyfills();

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { getDocument, GlobalWorkerOptions } = pdfjs as {
    getDocument: (src: {
      data: Uint8Array;
      useSystemFonts?: boolean;
      useWorkerFetch?: boolean;
      isEvalSupported?: boolean;
    }) => {
      promise: Promise<{
        numPages: number;
        getPage: (n: number) => Promise<{
          getTextContent: () => Promise<{ items: unknown[] }>;
        }>;
      }>;
    };
    GlobalWorkerOptions: { workerSrc: string };
  };

  configurePdfjsWorker(GlobalWorkerOptions);

  const data = new Uint8Array(buffer);
  const pdf = await getDocument({
    data,
    useSystemFonts: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const lineParts: string[] = [];
    let lastY: number | null = null;
    let line = "";

    for (const item of textContent.items) {
      if (!item || typeof item !== "object" || !("str" in item)) continue;
      const str = (item as { str?: string }).str;
      if (!str) continue;
      const y = Math.round((item as { transform?: number[] }).transform?.[5] ?? 0);
      if (lastY !== null && Math.abs(y - lastY) > 4) {
        if (line.trim()) lineParts.push(line.trim());
        line = str;
      } else {
        line += (line && !line.endsWith(" ") && !str.startsWith(" ") ? " " : "") + str;
      }
      lastY = y;
    }
    if (line.trim()) lineParts.push(line.trim());
    pages.push(lineParts.join("\n"));
  }

  return {
    text: normalizeJudgmentText(pages.join("\n\n")),
    pageCount: pdf.numPages,
  };
}
