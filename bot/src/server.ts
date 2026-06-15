/**
 * 봇 워커 HTTP 서버
 * LawyGo(Next.js) 웹앱이 서버 측에서 호출하는 엔드포인트.
 * Playwright/OCR 은 Vercel 서버리스에서 못 돌므로, 이 워커는
 * 별도 호스트(VM/사내 서버)에서 상시 실행합니다.
 *
 *   GET  /health           → { ok: true }
 *   POST /search           → { jobs: SearchParams[], save?: boolean } → { results }
 *     헤더 x-bot-token 이 BOT_API_TOKEN 과 일치해야 함.
 *
 * 실행: npm run serve
 */
import http from "node:http";
import { config } from "./config.js";
import { runBatch } from "./pool.js";
import { saveCaseResult } from "./store.js";
import type { SearchOutcome, SearchParams } from "./types.js";

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 1_000_000) reject(new Error("payload too large"));
      else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf-8")) : {});
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url ?? "";

    if (req.method === "GET" && url.startsWith("/health")) {
      return send(res, 200, { ok: true, provider: config.ocr.provider, formUrl: config.formUrl });
    }

    if (req.method === "POST" && url.startsWith("/search")) {
      // 인증
      if (config.server.token) {
        const token = req.headers["x-bot-token"];
        if (token !== config.server.token) return send(res, 401, { error: "unauthorized" });
      }

      const body = (await readJson(req)) as { jobs?: SearchParams[]; save?: boolean };
      const jobs = Array.isArray(body.jobs) ? body.jobs : [];
      if (!jobs.length) return send(res, 400, { error: "jobs[] 가 필요합니다." });
      if (jobs.length > 50) return send(res, 400, { error: "한 번에 최대 50건까지." });

      const results: SearchOutcome[] = await runBatch(jobs, {
        onResult: async (o) => {
          if (body.save && o.ok && o.data && !o.notFound) {
            await saveCaseResult(o.data).catch(() => {});
          }
        },
      });

      // rawHtml 은 응답에서 제외(용량/민감)
      const slim = results.map(({ rawHtml: _rawHtml, ...rest }) => rest);
      return send(res, 200, { results: slim });
    }

    send(res, 404, { error: "not found" });
  } catch (e) {
    send(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(config.server.port, "0.0.0.0", () => {
  console.log(`[bot-worker] listening on :${config.server.port}`);
  console.log(`  formUrl=${config.formUrl} ocr=${config.ocr.provider} auth=${config.server.token ? "on" : "OFF(주의)"}`);
});
