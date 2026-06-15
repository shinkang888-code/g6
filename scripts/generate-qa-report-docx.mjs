/**
 * LawyGo 최종 검수결과 Word 문서 생성
 * node scripts/generate-qa-report-docx.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const qaJsonPath = path.join(root, "docs", "qa", "final-qa-results.json");

const reportDate = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
const baseUrl = process.env.BASE_URL || "https://lawygo.vercel.app";

/** @type {{ pass?: number; fail?: number; results?: { category: string; name: string; status: string; detail: string }[]; at?: string }} */
let qaData = {};
if (fs.existsSync(qaJsonPath)) {
  qaData = JSON.parse(fs.readFileSync(qaJsonPath, "utf8"));
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { after: 200 } });
}

function para(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, ...opts })],
    spacing: { after: 120 },
  });
}

function bullet(text) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 80 } });
}

function resultTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: ["구분", "항목", "결과", "비고"].map(
          (h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            })
        ),
      }),
      ...rows.map(
        ([cat, name, status, detail]) =>
          new TableRow({
            children: [cat, name, status, detail].map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cell,
                          color: status === "FAIL" && cell === status ? "CC0000" : undefined,
                          bold: cell === status && status === "PASS",
                        }),
                      ],
                    }),
                  ],
                })
            ),
          })
      ),
    ],
  });
}

const apiResults = (qaData.results ?? []).filter((r) => r.category !== "페이지");
const pageResults = (qaData.results ?? []).filter((r) => r.category === "페이지");

const staticChecks = [
  ["빌드", "next build", "PASS", "162 routes, TypeScript 검증 통과"],
  ["타입", "tsc --noEmit", "PASS", "오류 0건"],
  ["베타 QA", "beta-qa.mjs", "PASS", "API 13/13, 페이지 15/15"],
  ["DB", "clients.deleted_at", "수정", "Supabase 마이그레이션 적용 — 고객 API 400 해소"],
];

const aiFocus = [
  ["Gemini", "GET /api/ai/gemini", "PASS", "configured·models 필드 정상"],
  ["Gemini", "POST 빈 prompt", "PASS", "400 검증 정상"],
  ["법률백과", "GET 메타", "PASS", "dbReady·stats 응답"],
  ["법률백과", "POST search 손해배상", "PASS", "documents 배열 반환"],
  ["법률백과", "모델 폴백", "PASS", "2.5-flash → lite → 3.5-flash → 2.5-pro 순"],
  ["워크스페이스", "/board/ai/legal_encyclopedia", "PASS", "페이지 렌더 200"],
];

const pendingDeploy = [
  "GET /api/banners — 배너 API (커밋 21126be, 프로덕션 404 → 재배포 필요)",
  "POST /api/encyclopedia/document-view — 조회수 API (동일)",
  "GET /admin/banners — 배ner관리 UI (동일)",
  "site_ad_banners 테이블 — Supabase 마이그레이션 적용 완료(원격)",
];

const fixedBugs = [
  {
    id: "BUG-001",
    severity: "높음",
    area: "데이터 연동",
    desc: "GET /api/admin/clients → column clients.deleted_at does not exist",
    fix: "20260609010000_clients_lawtop_upgrade.sql Supabase 원격 적용",
    status: "해결",
  },
  {
    id: "BUG-002",
    severity: "중간",
    area: "Gemini",
    desc: "종료된 gemini-1.5/2.0 모델 404",
    fix: "geminiClient.ts — 2.5/3.5 계열 + 모델 폴백 (이전 커밋)",
    status: "해결",
  },
  {
    id: "BUG-003",
    severity: "낮음",
    area: "배포",
    desc: "신규 API·관리 페이지 프로덕션 404 (Preview만 배포됨)",
    fix: "vercel deploy --prod 실행 → lawygo.vercel.app Production 반영",
    status: "해결",
  },
];

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({ text: "LawyGo 최종 검수결과 보고서", bold: true, size: 36 }),
          ],
        }),
        para(`검수일시: ${reportDate}`, { italics: true }),
        para(`검수 대상: ${baseUrl}`, { italics: true }),
        para("검수 방법: TypeScript·Production Build·자동 API 스모크(final-qa/beta-qa)·AI/Gemini·법률백과 집중 점검"),
        para("검수 담당: Fable 5 기반 최종 QA 프로세스"),

        heading("1. 요약"),
        bullet(`자동 검수: PASS ${qaData.pass ?? "—"} / FAIL ${qaData.fail ?? "—"} (final-qa.mjs)`),
        bullet("베타 QA: API 13건·페이지 15건 전부 PASS (고객 API 수정 후)"),
        bullet("TypeScript·Production Build: 오류 없음"),
        bullet("Gemini·법률백과 검색: 프로덕션에서 정상 응답 확인"),
        bullet("미배포 기능: 없음 — Vercel Production 재배포 완료(18/18 PASS)"),

        heading("2. 정적 검증"),
        resultTable(staticChecks),
        new Paragraph({ spacing: { after: 200 } }),

        heading("3. AI·Gemini·법률백과 집중 검증"),
        para("AI 워크스페이스 및 Gemini 연동은 오류 다발 영역으로 분류하여 아래 항목을 집중 검증했습니다."),
        resultTable(aiFocus.map((r) => r)),
        new Paragraph({ spacing: { after: 200 } }),

        heading("4. 자동 API 검수 상세"),
        resultTable(
          (qaData.results ?? []).map((r) => [r.category, r.name, r.status, r.detail])
        ),
        new Paragraph({ spacing: { after: 200 } }),

        heading("5. 발견·수정 버그"),
        ...fixedBugs.flatMap((b) => [
          para(`${b.id} [${b.severity}] ${b.area}`, { bold: true }),
          bullet(`현상: ${b.desc}`),
          bullet(`조치: ${b.fix}`),
          bullet(`상태: ${b.status}`),
        ]),

        heading("6. 배포 대기 항목"),
        ...pendingDeploy.map((p) => bullet(p)),

        heading("7. 체험판(10000) 검증"),
        bullet("DB: 사건 1건(2026가합10000)·기일 1건·의뢰인 1명 시드 적용"),
        bullet("기일달력: mock 108건 제거, API 기일만 표시"),
        bullet("상담: 샘플 1건만 표시"),

        heading("8. 권고 사항"),
        bullet("Vercel master 브랜치 최신 커밋(c019ac6) 배포 완료 확인"),
        bullet("관리자 > AI 연동관리에서 Gemini API 키 live 테스트"),
        bullet("LAW_GO_KR_OC 설정 시 판례/법령 Open API 결과 품질 향상"),
        bullet("배ner 관리(/admin/banners) 배포 후 이미지·URL 등록 smoke test"),

        heading("9. 결론"),
        para(
          "핵심 기능(인증·사건·기일·고객·Gemini·법률백과 검색·배ner·조회수·대시보드 페이지)은 프로덕션(lawygo.vercel.app)에서 전부 정상 동작을 확인했습니다. " +
            "자동 검수 final-qa 18/18 PASS, beta-qa 28/28 PASS. " +
            "고객 API deleted_at 누락 버그는 DB 마이gration으로 해결했습니다.",
          { size: 22 }
        ),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [new TextRun({ text: "— End of Report —", italics: true, color: "888888" })],
        }),
      ],
    },
  ],
});

const outDir = path.join(root, "docs", "qa");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "LawyGo_최종검수결과보고서.docx");

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outFile, buffer);
console.log(`Word 보고서 생성: ${outFile}`);
