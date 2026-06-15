/** 문서 OCR 결과 */

export type OcrMethod =
  | "pdf-text"
  | "vision"
  | "clova"
  | "gemini-vision"
  | "pasted";

export type DocumentOcrResult = {
  text: string;
  method: OcrMethod;
  pageCount?: number;
  charCount: number;
  warnings?: string[];
};

export const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/tiff",
  "image/bmp",
  "image/gif",
]);

export const DOCUMENT_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,image/tiff,image/bmp,.pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff";

export function isPdfMime(mime: string, fileName: string): boolean {
  return mime === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
}

export function isImageMime(mime: string, fileName: string): boolean {
  if (IMAGE_MIME_TYPES.has(mime)) return true;
  return /\.(jpe?g|png|webp|tiff?|bmp|gif)$/i.test(fileName);
}

/** PDF 텍스트 추출이 충분한지 (스캔 PDF면 OCR 필요) */
export function needsOcrFallback(extracted: string, pageCount: number): boolean {
  const len = extracted.trim().length;
  if (len < 60) return true;
  if (pageCount > 0 && len / pageCount < 40) return true;
  return false;
}
