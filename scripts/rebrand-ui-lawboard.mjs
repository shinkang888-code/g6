/**
 * UI 노출 텍스트 LawyGo → LawBoard (내부 키/식별자 제외)
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const root = process.cwd();

const files = [
  "src/app/layout.tsx",
  "src/app/manifest.ts",
  "src/app/login/page.tsx",
  "src/app/www/layout.tsx",
  "src/app/landing/page.tsx",
  "src/app/board/page.tsx",
  "src/app/calendar/manage/page.tsx",
  "src/app/cases/scourt-search/page.tsx",
  "src/app/admin/g6/page.tsx",
  "src/app/admin/settings/integration/page.tsx",
  "src/lib/tabTitle.ts",
  "src/lib/wwwContent.ts",
  "src/lib/subscription/subscriptionConfig.ts",
  "src/lib/googleDriveClient.ts",
  "src/lib/gnuboard.ts",
  "src/lib/envSetupKeys.ts",
  "src/lib/appUrl.ts",
  "src/app/api/drive/status/route.ts",
  "src/app/api/admin/settings/drive/route.ts",
  "src/components/layout/Sidebar.tsx",
  "src/components/admin/DriveSettingsPanel.tsx",
  "src/components/admin/LawOpenApiSettingsPanel.tsx",
  "src/components/admin/security/SecurityOverviewPanel.tsx",
  "src/components/admin/security/SecurityCommandCenter.tsx",
  "src/components/admin/security/SecurityLogExplorer.tsx",
  "src/components/admin/security/SecurityDashboard.tsx",
  "src/components/www/WwwPricingPage.tsx",
  "src/components/www/WwwModuleGrid.tsx",
  "src/components/www/WwwFooter.tsx",
  "src/components/www/WwwCtaBanner.tsx",
  "src/components/www/WwwStats.tsx",
  "src/components/www/WwwTestimonials.tsx",
  "src/components/www/WwwProductTabs.tsx",
  "src/components/www/WwwTrustBar.tsx",
  "src/components/www/WwwHero.tsx",
  "src/components/www/WwwDashboardMockup.tsx",
  "src/components/www/WwwNav.tsx",
  "src/components/landing/LandingDesignV1.tsx",
  "src/components/landing/LandingDesignV2.tsx",
  "src/components/landing/LandingDesignV3.tsx",
  "src/components/landing/LandingNav.tsx",
  "src/components/landing/DashboardMockup.tsx",
  "public/offline.html",
  "public/icons/lawygo-icon.svg",
  "README.md",
];

const replacements = [
  [/LawyGo/g, "LawBoard"],
  [/Lawygo/g, "LawBoard"],
  [/lawygo\.vercel\.app/g, "lawboard.vercel.app"],
  [/lawygo\.app/g, "lawboard.app"],
  [/lawygo-security/g, "lawboard-security"],
  [/lawygo 폴더/g, "LawBoard 폴더"],
  [/lawygo 폴더/gi, "LawBoard 폴더"],
];

let changed = 0;
for (const rel of files) {
  const fp = path.join(root, rel);
  if (!existsSync(fp)) {
    console.log(`SKIP (missing): ${rel}`);
    continue;
  }
  let text = readFileSync(fp, "utf8");
  const before = text;
  for (const [re, to] of replacements) {
    text = text.replace(re, to);
  }
  if (text !== before) {
    writeFileSync(fp, text, "utf8");
    console.log(`OK: ${rel}`);
    changed++;
  }
}

console.log(`\n${changed} file(s) updated.`);
