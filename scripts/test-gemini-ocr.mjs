/**
 * Gemini OCR 연동 검증 (로컬)
 * node scripts/test-gemini-ocr.mjs [image-path]
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const imagePath =
  process.argv[2] ??
  join(
    root,
    "..",
    ".cursor",
    "projects",
    "c-Users-FORYOUCOM-Documents-cursor-lawygo",
    "assets",
    "c__Users_FORYOUCOM_AppData_Roaming_Cursor_User_workspaceStorage_8bfb518d55de8d1ef921a735930590bf_images_image-0e9fe076-aa13-4e7b-b705-6a6acafc8739.png"
  );

async function getGeminiKeyFromDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { key: "", source: "none", error: "Supabase env missing" };

  const res = await fetch(`${url}/rest/v1/app_settings?key=eq.ai_settings&select=value`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return { key: "", source: "db", error: `DB ${res.status}` };
  const rows = await res.json();
  const gemini = rows?.[0]?.value?.geminiApiKey?.trim() ?? "";
  return { key: gemini, source: "db", error: gemini ? null : "empty in ai_settings" };
}

async function testGeminiVision(apiKey, buffer, mimeType) {
  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash"];
  const prompt =
    "이 문서(판결문·법률 문서)의 본문 텍스트를 빠짐없이 추출하세요. 【주문】【이유】【범죄사실】 등 구조와 줄바꿈을 유지하고, 설명·요약 없이 추출된 텍스트만 출력하세요.";

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    });
    const text = await res.text();
    if (res.ok) {
      const json = JSON.parse(text);
      const out = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      return { ok: true, model, length: out.length, sample: out.slice(0, 200) };
    }
    console.log(`  FAIL ${model}: ${res.status} ${text.slice(0, 300)}`);
  }
  return { ok: false };
}

async function main() {
  console.log("=== Gemini OCR 진단 ===\n");

  const envKey = (process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "").trim();
  const db = await getGeminiKeyFromDb();
  const apiKey = envKey || db.key;

  console.log(`Env GEMINI: ${envKey ? "yes (" + envKey.length + " chars)" : "no"}`);
  console.log(`DB ai_settings: ${db.key ? "yes (" + db.key.length + " chars)" : db.error ?? "no"}`);
  console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "yes" : "no"}`);
  console.log(`Service role: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "yes" : "no"}`);

  if (!apiKey) {
    console.error("\nFAIL: Gemini API 키 없음");
    process.exit(1);
  }

  if (!existsSync(imagePath)) {
    console.error(`\nSKIP image: ${imagePath}`);
    process.exit(0);
  }

  const buffer = readFileSync(imagePath);
  console.log(`\nImage: ${imagePath} (${buffer.length} bytes)`);

  const result = await testGeminiVision(apiKey, buffer, "image/png");
  if (result.ok) {
    console.log(`\nOK model=${result.model} chars=${result.length}`);
    console.log(`Sample: ${result.sample}…`);
    process.exit(0);
  }

  console.error("\nFAIL: 모든 Gemini 모델 OCR 실패");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
