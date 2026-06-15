/**
 * 판결문 PDF·이미지 OCR 텍스트 추출
 * POST multipart/form-data: file
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedSession } from "@/lib/adminSession";
import { extractDocumentText } from "@/lib/documentOcr/extractDocumentText";
import { getOcrAvailability } from "@/lib/documentOcr/ocrProviders";
import { DOCUMENT_ACCEPT, isImageMime, isPdfMime } from "@/lib/documentOcr/types";
import { getClientIdentifier, LIMIT_PDF_PER_MIN } from "@/lib/rateLimit";
import { enforceRateLimit } from "@/lib/security/rateLimitGuard";

export async function GET() {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  return NextResponse.json({
    accept: DOCUMENT_ACCEPT,
    providers: await getOcrAvailability(),
    pipeline: [
      "PDF: 내장 텍스트 추출(pdfjs) → Vision/CLOVA/Gemini OCR",
      "이미지: Vision → CLOVA → Gemini OCR",
      "요약: Gemini (doc_summary)",
    ],
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedSession();
  if ("error" in auth) return auth.error;

  const limited = enforceRateLimit(
    request,
    `document:ocr:${auth.session.userId || getClientIdentifier(request)}`,
    LIMIT_PDF_PER_MIN,
    { routePath: "/api/document/ocr", source: "api" }
  );
  if (limited) return limited;

  const form = await request.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  const fileName = file.name || "document";

  if (!isPdfMime(mimeType, fileName) && !isImageMime(mimeType, fileName)) {
    return NextResponse.json(
      { error: "PDF 또는 이미지(JPG, PNG, WEBP, TIFF)만 업로드할 수 있습니다." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractDocumentText(buffer, fileName, mimeType);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "OCR 처리 실패" },
      { status: 422 }
    );
  }
}
