/**
 * ssgo '사건검색 결과 저장' 자동 체크 검증
 * npx tsx bot/scripts/test-scourt-save-checkbox.ts
 */
import { chromium } from "playwright";
import { selectors } from "../src/selectors.js";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto("https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(3000);

  const box = page.locator(selectors.saveResultCheckbox);
  const before = await box.isChecked().catch(() => false);
  if (before) {
    await box.uncheck({ force: true }).catch(() => {});
  }

  await box.check({ force: true });
  const after = await box.isChecked();
  if (!after) {
    throw new Error("사건검색 결과 저장 체크박스를 켤 수 없습니다.");
  }

  console.log("test-scourt-save-checkbox: passed");
  await browser.close();
}

main().catch((e) => {
  console.error("test-scourt-save-checkbox: FAIL", e.message || e);
  process.exit(1);
});
