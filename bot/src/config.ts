/** 환경설정 로더 (.env) */
import "dotenv/config";

function str(key: string, fallback = ""): string {
  return (process.env[key] ?? fallback).trim();
}
function num(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function bool(key: string, fallback: boolean): boolean {
  const v = str(key).toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

export type OcrProviderName = "ddddocr" | "tesseract" | "clova" | "vision";

export const config = {
  // 현재 나의사건검색은 ssgo 시스템으로 운영됩니다(레거시 safind 는 폐지됨).
  formUrl: str("SCOURT_FORM_URL", "https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www"),
  headless: bool("HEADLESS", true),
  concurrency: num("BOT_CONCURRENCY", 2),
  captchaMaxRetry: num("CAPTCHA_MAX_RETRY", 5),
  requestDelayMs: num("REQUEST_DELAY_MS", 1500),

  ocr: {
    provider: (str("OCR_PROVIDER", "ddddocr") as OcrProviderName),
    // ddddocr 사이드카(HTTP). 캡차 특화 무료 OCR(권장). 예: http://127.0.0.1:8000
    ddddocrUrl: str("DDDDOCR_URL", "http://127.0.0.1:8000"),
    // 인식 결과 문자 범위 제한(선택). 숫자 캡차면 "0123456789" 등. 빈 값이면 미적용.
    ddddocrCharsets: str("DDDDOCR_CHARSETS"),
    clovaUrl: str("CLOVA_OCR_URL"),
    clovaSecret: str("CLOVA_OCR_SECRET"),
    googleVisionKey: str("GOOGLE_VISION_API_KEY"),
  },

  server: {
    // Railway/Fly 등 PaaS 는 PORT 를 주입. 로컬은 BOT_PORT(기본 8787).
    port: num("PORT", num("BOT_PORT", 8787)),
    token: str("BOT_API_TOKEN"),
  },

  supabase: {
    url: str("NEXT_PUBLIC_SUPABASE_URL"),
    serviceKey: str("SUPABASE_SERVICE_ROLE_KEY"),
    get enabled() {
      return Boolean(this.url && this.serviceKey);
    },
  },
} as const;

export type AppConfig = typeof config;
