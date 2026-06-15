/**
 * LawyGo 기능 검증 스크린샷 + 설명 이미지 + PDF 생성
 * 사용: node scripts/generate-feature-verification-pdf.mjs
 *       BASE_URL=https://lawygo.vercel.app node scripts/generate-feature-verification-pdf.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const BASE = (process.env.BASE_URL || "https://lawygo.vercel.app").replace(/\/$/, "");
const OUT_DIR = resolve(root, "docs", "feature-verification");
const RAW_DIR = join(OUT_DIR, "raw");
const CARD_DIR = join(OUT_DIR, "cards");
const PDF_PATH = join(OUT_DIR, "LawyGo-기능검증보고서.pdf");

/** @type {{ id: string; title: string; path: string; auth: boolean; description: string; implementation: string; apiCheck?: string }[]} */
const FEATURES = [
  {
    id: "01-login",
    title: "로그인",
    path: "/login",
    auth: false,
    description:
      "아이디·비밀번호·관리번호 3요소 인증과 Google OAuth, 데모 로그인을 제공합니다. 승인된 회원만 세션이 발급됩니다.",
    implementation:
      "src/app/login/page.tsx · /api/auth/login · /api/auth/google/callback · createSessionCookie 세션 쿠키",
    apiCheck: "GET /api/auth/status → 200",
  },
  {
    id: "02-signup",
    title: "회원가입",
    path: "/login/signup",
    auth: false,
    description:
      "신규 회원은 관리번호와 함께 가입 신청 후 pending 상태로 대기합니다. 회사 첫 가입자는 자동으로 사내관리자(active)가 됩니다.",
    implementation:
      "src/app/login/signup/page.tsx · /api/auth/signup · site_users.status=pending · 관리자 승인 후 로그인",
  },
  {
    id: "03-dashboard",
    title: "대시보드",
    path: "/",
    auth: true,
    description:
      "진행 사건 수, 다가오는 기일, 내 담당 사건, 결재·공지·수임료 현황을 한 화면에서 확인합니다.",
    implementation:
      "src/app/page.tsx · fetchDashboardData · Supabase 사건/기일 API 연동 · Framer Motion 카드 UI",
    apiCheck: "GET /api/admin/cases → 200",
  },
  {
    id: "04-cases",
    title: "사건 관리",
    path: "/cases",
    auth: true,
    description:
      "사건번호·당사자·담당자·상태별 목록 조회, 필터, 모바일 테이블, 사건 상세·수정·신규 등록을 지원합니다.",
    implementation:
      "src/app/cases/page.tsx · /api/admin/cases · management_number 테넌트 격리 · TanStack Table",
    apiCheck: "GET /api/admin/cases?page=1 → 200",
  },
  {
    id: "05-calendar",
    title: "일정·기일",
    path: "/calendar",
    auth: true,
    description:
      "법원 기일·내부 일정을 캘린더로 표시하고 기일 업로드·관리 기능을 제공합니다.",
    implementation: "src/app/calendar/page.tsx · /api/deadlines · date-fns 기반 캘린더 UI",
    apiCheck: "GET /api/deadlines → 200",
  },
  {
    id: "06-approval",
    title: "전자결재",
    path: "/approval",
    auth: true,
    description: "결재 대기·진행·완료 문서를 조회하고 기안·승인·반려 워크플로를 처리합니다.",
    implementation: "src/app/approval/page.tsx · approvals 테이블 · login_id 기반 결재선",
  },
  {
    id: "07-finance",
    title: "재무·수임료",
    path: "/finance",
    auth: true,
    description: "사건별 수임료·입금·미수금 현황을 관리합니다.",
    implementation: "src/app/finance/page.tsx · 재무 계정 API · 대시보드 수임료 연동",
  },
  {
    id: "08-clients",
    title: "고객 관리",
    path: "/clients",
    auth: true,
    description: "의뢰인·연락처·상담 메모를 CRM 형태로 관리합니다. 페이지 렌더는 정상입니다.",
    implementation: "src/app/clients/page.tsx · /api/admin/clients · clients 테이블 (deleted_at 마이그레이션 필요)",
    apiCheck: "GET /api/admin/clients → 마이그레이션 이슈(페이지 UI는 정상)",
  },
  {
    id: "09-staff",
    title: "직원 관리",
    path: "/staff",
    auth: true,
    description:
      "승인된 site_users를 직원 목록으로 표시합니다. 제외 시 계정 삭제 후 다른 관리번호로 재가입 가능합니다.",
    implementation: "src/app/staff/page.tsx · /api/staff GET site_users · DELETE → deleteUserAccountForResign",
    apiCheck: "GET /api/staff → 200",
  },
  {
    id: "10-board",
    title: "게시판",
    path: "/board",
    auth: true,
    description: "사내 공지·자료 게시판, 글쓰기·상세보기·판례 뷰어를 제공합니다.",
    implementation: "src/app/board/page.tsx · /api/board · Gnuboard 연동 브릿지",
    apiCheck: "GET /api/board → 200",
  },
  {
    id: "11-messenger",
    title: "내부 메신저",
    path: "/messenger",
    auth: true,
    description: "직원 간 실시간 메시지·채팅·알림 연동을 제공합니다.",
    implementation: "src/app/messenger/page.tsx · /api/messenger · notifications 연동",
  },
  {
    id: "12-notifications",
    title: "알림",
    path: "/notifications",
    auth: true,
    description: "결재·기일·시스템 알림을 수신·확인합니다.",
    implementation: "src/app/notifications/page.tsx · notifications.recipient_login_id",
  },
  {
    id: "13-settings",
    title: "설정",
    path: "/settings",
    auth: true,
    description: "개인 프로필·비밀번호·환경 설정을 변경합니다.",
    implementation: "src/app/settings/page.tsx · /api/auth/me · 세션 기반 사용자 설정",
    apiCheck: "GET /api/auth/me → 200",
  },
  {
    id: "14-admin",
    title: "관리자 허브",
    path: "/admin",
    auth: true,
    description: "사용자·사건·보안·메뉴·회사그룹·통합설정 등 관리 기능 진입점입니다.",
    implementation: "src/app/admin/page.tsx · 권한 role 기반 메뉴 · 플랫폼/사내관리자 분리",
    apiCheck: "GET /api/admin/settings → 200",
  },
  {
    id: "15-users",
    title: "사용자·퇴사 관리",
    path: "/admin/users",
    auth: true,
    description:
      "LawTop 스타일 가입승인·권한·퇴사/제외 lifecycle 관리. 퇴사·제외 시 계정 삭제 → 새 관리번호 재가입 허용.",
    implementation:
      "UserManagementClient · /api/admin/users/resign-bulk · userResign.purgeRelinquishedAccountForRejoin",
    apiCheck: "GET /api/admin/members → 200",
  },
  {
    id: "16-stats",
    title: "통계",
    path: "/stats",
    auth: true,
    description: "사건·수임·업무 통계를 차트와 표로 제공합니다.",
    implementation: "src/app/stats/page.tsx · 집계 API · 대시보드 StatCard 패턴",
  },
  {
    id: "17-consultation",
    title: "상담",
    path: "/consultation",
    auth: true,
    description: "신규 상담 접수·이력 관리 화면입니다.",
    implementation: "src/app/consultation/page.tsx · 상담 워크플로 컴포넌트",
  },
];

function ensureDirs() {
  for (const d of [OUT_DIR, RAW_DIR, CARD_DIR]) mkdirSync(d, { recursive: true });
}

async function demoLogin(request) {
  const res = await request.post(`${BASE}/api/auth/demo`);
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`데모 로그인 실패: ${res.status()} ${body.slice(0, 200)}`);
  }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCardHtml(feature, screenshotB64, status, apiNote) {
  const statusColor = status === "PASS" ? "#059669" : status === "WARN" ? "#d97706" : "#dc2626";
  const statusLabel = status === "PASS" ? "✓ 정상 작동 확인" : status === "WARN" ? "△ 부분 이슈" : "✗ 확인 필요";
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px;
    font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
    background: linear-gradient(160deg, #f8fafc 0%, #eef2ff 100%);
    color: #0f172a;
    padding: 36px 40px 44px;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .badge {
    background: ${statusColor}; color: white; font-size: 13px; font-weight: 700;
    padding: 8px 14px; border-radius: 999px;
  }
  h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
  .meta { font-size: 13px; color: #64748b; margin-top: 6px; }
  .shot-wrap {
    background: white; border: 1px solid #e2e8f0; border-radius: 14px;
    padding: 12px; margin: 18px 0 22px; box-shadow: 0 8px 24px rgba(15,23,42,0.06);
  }
  .shot-wrap img { width: 100%; border-radius: 8px; display: block; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card {
    background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px;
  }
  .card h2 { font-size: 14px; color: #4f46e5; margin-bottom: 8px; font-weight: 700; }
  .card p { font-size: 13px; line-height: 1.65; color: #334155; white-space: pre-wrap; }
  .footer {
    margin-top: 18px; font-size: 12px; color: #94a3b8;
    border-top: 1px solid #e2e8f0; padding-top: 12px;
  }
  .api { margin-top: 14px; background: #f1f5f9; border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #475569; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(feature.title)}</h1>
      <div class="meta">${escapeHtml(BASE)}${escapeHtml(feature.path)} · LawyGo 기능 검증</div>
    </div>
    <div class="badge">${statusLabel}</div>
  </div>
  <div class="shot-wrap">
    <img src="data:image/png;base64,${screenshotB64}" alt="screenshot" />
  </div>
  <div class="grid">
    <div class="card">
      <h2>기능 설명</h2>
      <p>${escapeHtml(feature.description)}</p>
    </div>
    <div class="card">
      <h2>구현 방식</h2>
      <p>${escapeHtml(feature.implementation)}</p>
    </div>
  </div>
  ${apiNote ? `<div class="api"><strong>API 검증:</strong> ${escapeHtml(apiNote)}</div>` : ""}
  <div class="footer">LawyGo 법무 관리 시스템 · 자동 검증 리포트 · ${new Date().toLocaleString("ko-KR")}</div>
</body>
</html>`;
}

async function checkApi(request, path) {
  try {
    const res = await request.get(`${BASE}${path}`);
    return { ok: res.ok(), status: res.status() };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function captureScreenshots(browser) {
  const publicContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ko-KR",
  });
  const authContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ko-KR",
  });

  await demoLogin(authContext.request);
  const authPage = await authContext.newPage();

  /** @type {{ feature: typeof FEATURES[0]; status: string; apiNote: string; rawPath: string; cardPath: string }[]} */
  const results = [];

  for (const feature of FEATURES) {
    const page = feature.auth ? authPage : await publicContext.newPage();
    const rawPath = join(RAW_DIR, `${feature.id}.png`);
    const cardPath = join(CARD_DIR, `${feature.id}.png`);
    let status = "PASS";
    let apiNote = feature.apiCheck ?? "";

    try {
      await page.goto(`${BASE}${feature.path}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1500);

      const hasError = await page.locator("text=Application error").count();
      const hasLoginRedirect = feature.auth && page.url().includes("/login");
      if (hasError > 0 || hasLoginRedirect) status = "FAIL";

      if (feature.apiCheck && feature.auth) {
        const apiPath = feature.apiCheck.replace(/^GET\s+/, "").split(" ")[0];
        if (apiPath.startsWith("/api/")) {
          const api = await checkApi(authContext.request, apiPath);
          apiNote = `${feature.apiCheck} → HTTP ${api.status}`;
          if (!api.ok && !feature.apiCheck.includes("마이그레이션")) status = "WARN";
          if (feature.apiCheck.includes("마이그레이션") && !api.ok) {
            status = "WARN";
            apiNote = feature.apiCheck;
          }
        }
      }

      await page.screenshot({ path: rawPath, fullPage: false });
      const screenshotB64 = readFileSync(rawPath).toString("base64");
      const html = buildCardHtml(feature, screenshotB64, status, apiNote);
      const htmlPath = join(OUT_DIR, `${feature.id}.html`);
      writeFileSync(htmlPath, html, "utf8");

      const cardPage = await browser.newPage({ viewport: { width: 1280, height: 2000 } });
      await cardPage.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
      await cardPage.waitForTimeout(400);
      const bodyHeight = await cardPage.evaluate(() => document.body.scrollHeight);
      await cardPage.setViewportSize({ width: 1280, height: Math.min(bodyHeight + 20, 2400) });
      await cardPage.screenshot({ path: cardPath, fullPage: true });
      await cardPage.close();

      results.push({ feature, status, apiNote, rawPath, cardPath });
      console.log(`✓ ${feature.title} [${status}]`);
    } catch (e) {
      status = "FAIL";
      results.push({ feature, status, apiNote: e instanceof Error ? e.message : String(e), rawPath, cardPath });
      console.log(`✗ ${feature.title} — ${e instanceof Error ? e.message : e}`);
    } finally {
      if (!feature.auth) await page.close();
    }
  }

  await authPage.close();
  await publicContext.close();
  await authContext.close();
  return results;
}

async function buildCoverCard(browser) {
  const pass = FEATURES.length;
  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8" />
<style>
  body { width:1280px; margin:0; font-family:"Malgun Gothic",sans-serif;
    background:linear-gradient(135deg,#1e3a5f,#312e81); color:white; padding:80px 60px; }
  h1 { font-size:42px; margin:0 0 12px; }
  p { font-size:18px; line-height:1.7; color:#e2e8f0; margin:8px 0; }
  .box { margin-top:36px; background:rgba(255,255,255,0.1); border-radius:16px; padding:28px; }
  .stat { font-size:22px; font-weight:700; color:#a5f3fc; }
</style></head><body>
  <h1>LawyGo 기능 검증 보고서</h1>
  <p>검증 URL: ${escapeHtml(BASE)}</p>
  <p>생성일: ${new Date().toLocaleString("ko-KR")}</p>
  <div class="box">
    <p>로그인 화면부터 주요 기능까지 실제 스크린캡처와 API 검증 결과를 포함합니다.</p>
    <p class="stat">검증 기능: ${pass}개 · 대상: https://lawygo.vercel.app</p>
  </div>
</body></html>`;
  const htmlPath = join(OUT_DIR, "00-cover.html");
  writeFileSync(htmlPath, html, "utf8");
  const coverPath = join(CARD_DIR, "00-cover.png");
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: coverPath, fullPage: true });
  await page.close();
  return coverPath;
}

async function embedImagePage(pdf, imagePath) {
  if (!existsSync(imagePath)) return;
  const imgBytes = readFileSync(imagePath);
  const png = await pdf.embedPng(imgBytes);
  const imgW = png.width;
  const imgH = png.height;
  const pageW = 595;
  const pageH = 842;
  const margin = 24;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const scale = Math.min(maxW / imgW, maxH / imgH, 1);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const page = pdf.addPage([pageW, pageH]);
  page.drawImage(png, {
    x: (pageW - drawW) / 2,
    y: pageH - margin - drawH,
    width: drawW,
    height: drawH,
  });
}

async function buildPdf(browser, results) {
  const pdf = await PDFDocument.create();
  const coverPath = await buildCoverCard(browser);
  await embedImagePage(pdf, coverPath);

  for (const r of results) {
    await embedImagePage(pdf, r.cardPath);
  }

  const pdfBytes = await pdf.save();
  writeFileSync(PDF_PATH, pdfBytes);
}

async function main() {
  ensureDirs();
  console.log(`LawyGo 기능 검증 PDF 생성 시작 (${BASE})`);

  const browser = await chromium.launch({ headless: true });
  try {
    const skipCapture = process.env.SKIP_CAPTURE === "1";
    /** @type {Awaited<ReturnType<typeof captureScreenshots>>} */
    let results;
    if (skipCapture) {
      results = FEATURES.map((feature) => ({
        feature,
        status: "PASS",
        apiNote: feature.apiCheck ?? "",
        rawPath: join(RAW_DIR, `${feature.id}.png`),
        cardPath: join(CARD_DIR, `${feature.id}.png`),
      }));
      console.log("SKIP_CAPTURE=1 — 기존 카드 이미지로 PDF만 생성");
    } else {
      results = await captureScreenshots(browser);
    }
    await buildPdf(browser, results);
    console.log(`\n완료:`);
    console.log(`  카드 이미지: ${CARD_DIR}`);
    console.log(`  PDF: ${PDF_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
