/** PDF ArrayBuffer에서 판결문 텍스트 추출 (브라우저 전용) */
export async function extractTextFromPdfBuffer(buffer: ArrayBuffer): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("PDF 텍스트 추출은 브라우저에서만 가능합니다.");
  }

  const pdfjs = await import("pdfjs-dist");
  const { getDocument, GlobalWorkerOptions, version } = pdfjs;

  GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const pdf = await getDocument({ data: buffer.slice(0) }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const lineParts: string[] = [];
    let lastY: number | null = null;
    let line = "";

    for (const item of textContent.items) {
      if (!("str" in item) || !item.str) continue;
      const y = Math.round((item as { transform?: number[] }).transform?.[5] ?? 0);
      if (lastY !== null && Math.abs(y - lastY) > 4) {
        if (line.trim()) lineParts.push(line.trim());
        line = item.str;
      } else {
        line += (line && !line.endsWith(" ") && !item.str.startsWith(" ") ? " " : "") + item.str;
      }
      lastY = y;
    }
    if (line.trim()) lineParts.push(line.trim());
    pages.push(lineParts.join("\n"));
  }

  return normalizeJudgmentText(pages.join("\n\n"));
}

export function normalizeJudgmentText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 추출 텍스트에서 판결문 구조 마커 감지 */
export function analyzeJudgmentStructure(text: string): string[] {
  const markers = [
    "주문",
    "주 문",
    "범죄사실",
    "범 죄 사 실",
    "이 유",
    "이유",
    "판단",
    "주장의 요지",
    "청구취지",
    "청구의 요지",
    "인정사실",
    "결론",
  ];
  return markers.filter((m) => text.includes(m));
}
