/**
 * 캡차 OCR 프로바이더
 * LawTop 의 Detect.dll + SELVAS AI 엔진을 대체.
 *
 * - ddddocr:   캡차 특화 무료 오픈소스 OCR (기본·권장). 별도 HTTP 사이드카 필요.
 *              (sml2h3/ddddocr, MIT, ONNX. 영숫자/노이즈 캡차에 Tesseract 대비 월등)
 * - tesseract: 로컬 무료 OCR (설치 불필요하나 캡차 정확도 낮음, 폴백용)
 * - clova:     Naver CLOVA OCR (한글 캡차 정확도 우수, 유료)
 * - vision:    Google Cloud Vision OCR
 *
 * 모든 프로바이더는 OcrProvider 인터페이스를 구현하므로 교체가 자유롭습니다.
 */
import { config, type OcrProviderName } from "./config.js";

export interface OcrProvider {
  /** 캡차 이미지(PNG/JPEG buffer) → 인식 문자열 */
  recognize(image: Buffer): Promise<string>;
  /** 종료 시 리소스 정리 */
  dispose?(): Promise<void>;
}

/** 캡차 후보 정규화: 영숫자만 남기고 대문자화 (대법원 캡차는 보통 숫자/영문) */
export function normalizeCaptcha(raw: string): string {
  return (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** ── ddddocr (캡차 특화 무료, 권장) ──
 * HTTP 사이드카 호출. 응답 형태가 배포본마다 달라 여러 키를 관용적으로 파싱.
 *   POST {url}/ocr  body: { image: base64, charsets?, png_fix }
 *   응답 예: {"result":"ab12"} 또는 {"code":200,"data":{"text":"ab12"}}
 */
class DdddocrProvider implements OcrProvider {
  async recognize(image: Buffer): Promise<string> {
    const base = config.ocr.ddddocrUrl.replace(/\/$/, "");
    if (!base) throw new Error("DDDDOCR_URL 이 설정되지 않았습니다.");
    const payload: Record<string, unknown> = {
      image: image.toString("base64"),
      png_fix: true,
    };
    if (config.ocr.ddddocrCharsets) payload.charsets = config.ocr.ddddocrCharsets;

    const res = await fetch(`${base}/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`ddddocr 실패: ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>;
    const data = json.data as Record<string, unknown> | undefined;
    const text =
      (json.result as string) ??
      (json.text as string) ??
      (data?.text as string) ??
      (data?.result as string) ??
      (typeof json.data === "string" ? (json.data as string) : "") ??
      "";
    // ddddocr 는 정확한 문자열을 반환하므로 공백만 제거(대소문자 보존)
    return (text ?? "").replace(/\s+/g, "");
  }
}

/** ── Tesseract (기본) ── */
class TesseractProvider implements OcrProvider {
  private worker: import("tesseract.js").Worker | null = null;

  private async ensure() {
    if (this.worker) return this.worker;
    const { createWorker } = await import("tesseract.js");
    // 캡차는 보통 영문+숫자. 언어팩은 eng 사용. 숫자 캡차면 'eng' 로 충분.
    this.worker = await createWorker("eng");
    await this.worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    });
    return this.worker;
  }

  async recognize(image: Buffer): Promise<string> {
    const worker = await this.ensure();
    const { data } = await worker.recognize(image);
    return normalizeCaptcha(data.text);
  }

  async dispose() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

/** ── Naver CLOVA OCR ── */
class ClovaProvider implements OcrProvider {
  async recognize(image: Buffer): Promise<string> {
    if (!config.ocr.clovaUrl || !config.ocr.clovaSecret) {
      throw new Error("CLOVA_OCR_URL / CLOVA_OCR_SECRET 가 설정되지 않았습니다.");
    }
    const body = {
      version: "V2",
      requestId: `captcha-${Date.now()}`,
      timestamp: Date.now(),
      images: [{ name: "captcha", format: "png", data: image.toString("base64") }],
    };
    const res = await fetch(config.ocr.clovaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OCR-SECRET": config.ocr.clovaSecret,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`CLOVA OCR 실패: ${res.status}`);
    const json = (await res.json()) as {
      images?: { fields?: { inferText?: string }[] }[];
    };
    const text = (json.images?.[0]?.fields ?? []).map((f) => f.inferText ?? "").join("");
    return normalizeCaptcha(text);
  }
}

/** ── Google Cloud Vision OCR ── */
class VisionProvider implements OcrProvider {
  async recognize(image: Buffer): Promise<string> {
    if (!config.ocr.googleVisionKey) {
      throw new Error("GOOGLE_VISION_API_KEY 가 설정되지 않았습니다.");
    }
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${config.ocr.googleVisionKey}`;
    const body = {
      requests: [
        {
          image: { content: image.toString("base64") },
          features: [{ type: "TEXT_DETECTION" }],
        },
      ],
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Vision OCR 실패: ${res.status}`);
    const json = (await res.json()) as {
      responses?: { fullTextAnnotation?: { text?: string } }[];
    };
    const text = json.responses?.[0]?.fullTextAnnotation?.text ?? "";
    return normalizeCaptcha(text);
  }
}

export function createOcrProvider(name: OcrProviderName = config.ocr.provider): OcrProvider {
  switch (name) {
    case "ddddocr":
      return new DdddocrProvider();
    case "clova":
      return new ClovaProvider();
    case "vision":
      return new VisionProvider();
    case "tesseract":
      return new TesseractProvider();
    default:
      return new DdddocrProvider();
  }
}
