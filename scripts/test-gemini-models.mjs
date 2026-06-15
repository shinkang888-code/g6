/**
 * Gemini 모델 목록 검증
 * node scripts/test-gemini-models.mjs
 */
const models = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-pro",
];

async function main() {
  const apiKey = (process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    console.log("SKIP: GOOGLE_GEMINI_API_KEY / GEMINI_API_KEY 없음 — 모델 목록만 출력");
    console.log(models.join("\n"));
    process.exit(0);
  }

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply OK only" }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
    });
    const body = await res.text();
    if (res.ok) {
      console.log(`OK  ${model}`);
    } else {
      let msg = body.slice(0, 120);
      try {
        msg = JSON.parse(body).error?.message ?? msg;
      } catch {
        /* ignore */
      }
      console.log(`FAIL ${model}: ${msg}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
