/**
 * OpenDataLoader PDF 연동 (선택)
 * - opendataloader-pdf는 JVM(Java 11+) 기반 파서 → Vercel 서버리스에서 직접 실행 불가
 * - OPENDATALOADER_SERVICE_URL 환경변수로 외부 변환 서비스 연결
 * @see https://github.com/shinkang888-code/opendataloader-pdf
 */

export type OpenDataLoaderFormat = "html" | "markdown" | "json";

export type StructuredPdfResponse = {
  source: "opendataloader" | "unavailable";
  html?: string;
  markdown?: string;
  json?: unknown;
  message?: string;
};

export async function convertViaOpenDataLoader(
  pdfBuffer: Buffer,
  fileName: string,
  format: OpenDataLoaderFormat = "html"
): Promise<StructuredPdfResponse> {
  const baseUrl = process.env.OPENDATALOADER_SERVICE_URL?.trim();
  if (!baseUrl) {
    return {
      source: "unavailable",
      message:
        "OpenDataLoader 서비스가 설정되지 않았습니다. 로컬에서 opendataloader-pdf-hybrid 서버를 실행한 뒤 OPENDATALOADER_SERVICE_URL을 설정하세요.",
    };
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/convert`;
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }), fileName);
  form.append("format", format);

  const res = await fetch(endpoint, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      source: "unavailable",
      message: `OpenDataLoader 변환 실패 (${res.status}): ${text.slice(0, 200)}`,
    };
  }

  const json = (await res.json()) as {
    html?: string;
    markdown?: string;
    data?: unknown;
  };

  return {
    source: "opendataloader",
    html: json.html,
    markdown: json.markdown,
    json: json.data,
  };
}
