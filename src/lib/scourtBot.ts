/**
 * 대법원 파싱봇 워커 호출 (서버 전용)
 * - 봇 워커는 별도 호스트에서 실행됩니다(bot/ 폴더, `npm run serve`).
 * - 워커 URL/토큰은 서버 환경변수로만 보관(클라이언트 노출 금지).
 *
 *   SCOURT_BOT_URL   예: http://127.0.0.1:8787  또는  https://bot.example.com
 *   SCOURT_BOT_TOKEN bot/.env 의 BOT_API_TOKEN 과 동일한 값
 *
 * @see bot/src/server.ts
 */

const BOT_URL = (process.env.SCOURT_BOT_URL ?? "").replace(/\/$/, "");
const BOT_TOKEN = process.env.SCOURT_BOT_TOKEN ?? "";

/** court.htm/ssgo 입력 필드에 대응하는 조회 파라미터 */
export interface ScourtJob {
  courtName: string;
  year: string;
  gubun: string;
  serial: string;
  partyName: string;
  matchCaseId?: string;
}

export interface ScourtEvent {
  date?: string;
  time?: string;
  type?: string;
  /** 기일장소 (예: 본관 301호 법정) */
  place?: string;
  detail?: string;
  result?: string;
}

export interface ScourtCaseData {
  court: string;
  client: string;
  caseNumber: string;
  caseName?: string;
  defendantName?: string;
  court_division?: string;
  receivedDate?: string;
  finalResult?: string;
  events?: ScourtEvent[];
  rawLine?: string;
  matchCaseId?: string;
}

export interface ScourtOutcome {
  ok: boolean;
  params: ScourtJob;
  data?: ScourtCaseData;
  notFound?: boolean;
  error?: string;
  captchaAttempts?: number;
}

export interface CallBotResult {
  ok: boolean;
  results?: ScourtOutcome[];
  error?: string;
  /** 워커 미설정 등으로 호출 자체가 불가한 경우 */
  code?: "BOT_NOT_CONFIGURED" | "BOT_UNREACHABLE" | "BOT_ERROR";
}

export function isBotConfigured(): boolean {
  return Boolean(BOT_URL);
}

/** 사건번호 문자열을 봇 파라미터로 분해. 예: "2026노107" → year/gubun/serial */
export function parseCaseNumber(caseNumber: string): { year?: string; gubun?: string; serial?: string } {
  const m = (caseNumber ?? "").replace(/\s/g, "").match(/^(\d{4})([가-힣A-Za-z]+)(\d+)$/);
  if (!m) return {};
  return { year: m[1], gubun: m[2], serial: m[3] };
}

/** 워커 /search 호출 */
export async function callScourtBot(jobs: ScourtJob[], save = false): Promise<CallBotResult> {
  if (!BOT_URL) {
    return {
      ok: false,
      code: "BOT_NOT_CONFIGURED",
      error: "SCOURT_BOT_URL 이 설정되지 않았습니다. 봇 워커를 실행하고 환경변수를 설정하세요.",
    };
  }
  try {
    const res = await fetch(`${BOT_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(BOT_TOKEN ? { "x-bot-token": BOT_TOKEN } : {}),
      },
      body: JSON.stringify({ jobs, save }),
      // 캡차 재시도로 시간이 걸릴 수 있어 넉넉히
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, code: "BOT_ERROR", error: `워커 오류 ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = (await res.json()) as { results?: ScourtOutcome[] };
    return { ok: true, results: json.results ?? [] };
  } catch (e) {
    return {
      ok: false,
      code: "BOT_UNREACHABLE",
      error: e instanceof Error ? e.message : "봇 워커에 연결할 수 없습니다.",
    };
  }
}
