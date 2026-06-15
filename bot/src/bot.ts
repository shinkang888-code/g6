/**
 * 핵심 파싱봇 (LawTop GL LawTopParsingBotWV 1:1 대응)
 *
 *  WebView2 내장 브라우저          → Playwright(Chromium)
 *  법원/연도/구분/일련번호/당사자명 입력 → selectOption / fill (실제 ssgo ID)
 *  캡차 캡처 → SELVAS AI OCR 입력   → captcha img element.screenshot → OcrProvider
 *  사건검색 버튼 클릭               → btn_srchCs
 *  결과(AJAX 렌더) → HtmlAgilityPack → parser.ts (cheerio)
 *
 * 대상: 현행 ssgo.scourt.go.kr (레거시 safind 폐지됨).
 * 주의: tsx(esbuild) 가 page.evaluate 에 __name 을 주입해 깨지므로,
 *       이 파일은 Playwright 네이티브 API(click/fill/selectOption/locator)만 사용.
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { config } from "./config.js";
import { selectors } from "./selectors.js";
import { createOcrProvider, type OcrProvider } from "./ocr.js";
import { isCaptchaError, isNotFound, parseCaseBasic } from "./parser.js";
import { normalizePartyNameForScourt } from "./partyName.js";
import { validatePartyName, validateSerial } from "./saGubun.js";
import type { SearchOutcome, SearchParams } from "./types.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ParsingBot {
  private browser: Browser | null = null;
  private ocr: OcrProvider;

  constructor(ocr?: OcrProvider) {
    this.ocr = ocr ?? createOcrProvider();
  }

  async launch(): Promise<void> {
    if (this.browser) return;
    this.browser = await chromium.launch({ headless: config.headless });
  }

  async close(): Promise<void> {
    await this.ocr.dispose?.();
    await this.browser?.close();
    this.browser = null;
  }

  /** 새 격리 컨텍스트 (LawTop 의 WV 인스턴스 1개에 대응) */
  async newContext(): Promise<BrowserContext> {
    if (!this.browser) await this.launch();
    return this.browser!.newContext({
      locale: "ko-KR",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    });
  }

  /** 1건 조회 */
  async search(params: SearchParams, ctx?: BrowserContext): Promise<SearchOutcome> {
    const partyName = normalizePartyNameForScourt(params.partyName);
    const normalized: SearchParams = {
      ...params,
      partyName,
    };
    const v1 = validateSerial(normalized.serial);
    if (!v1.ok) return { ok: false, params: normalized, error: v1.reason };
    if (!partyName) {
      return { ok: false, params: normalized, error: "의뢰인명 정규화 불가" };
    }
    const v2 = validatePartyName(normalized.partyName);
    if (!v2.ok) return { ok: false, params: normalized, error: v2.reason };

    const ownCtx = !ctx;
    const context = ctx ?? (await this.newContext());
    const page = await context.newPage();

    // WebSquare 검증/결과 alert 처리
    const dialogMessages: string[] = [];
    page.on("dialog", async (d) => {
      dialogMessages.push(d.message());
      await d.accept().catch(() => {});
    });

    let captchaAttempts = 0;
    try {
      await page.goto(config.formUrl, { waitUntil: "networkidle", timeout: 40000 });

      let html = "";
      for (let attempt = 1; attempt <= config.captchaMaxRetry; attempt++) {
        captchaAttempts = attempt;
        dialogMessages.length = 0;

        await this.fillForm(page, normalized);

        // OCR 결과가 6자리 숫자가 아니면 제출하지 않고 캡차만 새로고침 후 재시도
        const code = await this.solveCaptcha(page);
        if (!/^\d{6}$/.test(code)) {
          await page.click(selectors.captcha.reloadButton).catch(() => {});
          await sleep(config.requestDelayMs);
          continue;
        }
        await this.submit(page);

        // AJAX 결과/alert 대기 + 최근기일 그리드 tbody 렌더 대기
        await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
        await this.waitRecentEventsGrid(page);
        html = await page.content();

        // 판정은 사이트가 띄우는 alert(dialog) 메시지를 1차 신호로 사용.
        // (폼 페이지 HTML 에는 "자동입력방지문자 도입" 등 안내문이 상시 포함되어
        //  HTML 텍스트만으로는 오탐이 발생하므로 dialog 우선.)
        const dialogText = dialogMessages.join(" ");

        if (isCaptchaError(dialogText)) {
          // 캡차 오답 → 새로고침 후 재시도
          await page.click(selectors.captcha.reloadButton).catch(() => {});
          await sleep(config.requestDelayMs);
          continue;
        }
        if (isNotFound(dialogText)) {
          return { ok: true, notFound: true, params: normalized, captchaAttempts, rawHtml: html };
        }
        // 에러 dialog 가 없으면 캡차 통과 + 결과 렌더 성공으로 간주
        const data = parseCaseBasic(html, normalized);
        return { ok: true, params: normalized, data, captchaAttempts, rawHtml: html };
      }

      // 재시도 한도 초과(주로 캡차 연속 오답)
      return {
        ok: false,
        params,
        captchaAttempts,
        error: `캡차 인식 실패: ${config.captchaMaxRetry}회 재시도 초과`,
        rawHtml: html,
      };
    } catch (e) {
      return {
        ok: false,
        params,
        captchaAttempts,
        error: e instanceof Error ? e.message : String(e),
      };
    } finally {
      await page.close().catch(() => {});
      if (ownCtx) await context.close().catch(() => {});
    }
  }

  /** 폼 필드 자동 입력 (법원/구분은 option text, 연도는 value) */
  private async fillForm(page: Page, params: SearchParams): Promise<void> {
    const f = selectors.form;

    // 법원/구분 select 의 option 이 동적 로드될 수 있어 대기
    await this.waitOptions(page, f.courtSelect);
    await this.selectByLabel(page, f.courtSelect, params.courtName);

    await page.selectOption(f.yearSelect, params.year).catch(() => {});

    await this.waitOptions(page, f.gubunSelect);
    await this.selectByLabel(page, f.gubunSelect, params.gubun);

    await page.fill(f.serialInput, params.serial).catch(() => {});
    await page.fill(f.partyInput, params.partyName.replace(/\s/g, "")).catch(() => {});
    await this.ensureSaveResultChecked(page);
  }

  /** '사건검색 결과 저장' 자동 체크 — PC 이력·재조회 안정화 */
  private async ensureSaveResultChecked(page: Page): Promise<void> {
    const box = page.locator(selectors.saveResultCheckbox);
    if ((await box.count().catch(() => 0)) === 0) return;
    const checked = await box.isChecked().catch(() => false);
    if (!checked) {
      await box.check({ force: true }).catch(async () => {
        await page.locator(`#${selectors.saveResultCheckbox.replace("#", "")}`).click({ force: true }).catch(() => {});
      });
    }
  }

  /** select 옵션이 1개 초과로 채워질 때까지 대기 (네이티브 locator.count 사용) */
  private async waitOptions(page: Page, sel: string): Promise<void> {
    const opt = page.locator(`${sel} > option`);
    for (let i = 0; i < 20; i++) {
      if ((await opt.count().catch(() => 0)) > 1) return;
      await sleep(300);
    }
  }

  /** option 라벨로 선택 (정확일치 → 부분일치 fallback). page.evaluate 미사용. */
  private async selectByLabel(page: Page, sel: string, label: string): Promise<void> {
    try {
      await page.selectOption(sel, { label });
      return;
    } catch {
      // 부분일치: Playwright 네이티브 allTextContents 로 옵션 텍스트 확보
      const options = page.locator(`${sel} > option`);
      const texts = await options.allTextContents().catch(() => [] as string[]);
      const idx = texts.findIndex((t) => t.replace(/\s+/g, "").includes(label.replace(/\s+/g, "")));
      if (idx >= 0) {
        const value = await options.nth(idx).getAttribute("value");
        if (value != null) await page.selectOption(sel, value).catch(() => {});
      }
    }
  }

  /**
   * 캡차 캡처 → OCR → 입력 (blob 이미지라 element.screenshot 필수)
   * @returns 인식·입력한 문자열(검증 실패 판단용)
   */
  private async solveCaptcha(page: Page): Promise<string> {
    const img = page.locator(selectors.captcha.image);
    const input = page.locator(selectors.captcha.input);
    if ((await img.count().catch(() => 0)) === 0) return "";
    if ((await input.count().catch(() => 0)) === 0) return "";

    const buf = await img.screenshot().catch(() => null);
    if (!buf) return "";
    const text = (await this.ocr.recognize(buf as Buffer)).replace(/\D/g, "");
    if (text) {
      await input.fill("").catch(() => {});
      await input.type(text, { delay: 30 }).catch(() => {});
    }
    return text;
  }

  /** 사건검색 버튼 클릭 */
  private async submit(page: Page): Promise<void> {
    await page.click(selectors.submitButton).catch(() => {});
  }

  /**
   * WebSquare 최근기일 그리드는 networkidle 이후에도 tbody 가 비어 있을 수 있음.
   * 기일 행이 채워질 때까지 대기(없으면 타임아웃 후 진행 — 사건 없음/기일 없음).
   */
  private async waitRecentEventsGrid(page: Page): Promise<void> {
    const row = page.locator(selectors.recentEventsGridBody).first();
    const dateRe = /\d{4}[.\-/]\d{1,2}/;
    for (let i = 0; i < 40; i++) {
      const n = await row.count().catch(() => 0);
      if (n > 0) {
        const text = await row.locator("td").first().textContent().catch(() => "");
        const dataVal = await row.locator("td").first().getAttribute("data-value").catch(() => "");
        const sample = `${text ?? ""}${dataVal ?? ""}`;
        if (sample.replace(/\s/g, "") && dateRe.test(sample)) return;
      }
      await sleep(500);
    }
    await sleep(1200);
  }
}
