/**
 * fireauto /security-guard 8카테고리 코드 감사
 * @see docs/security/CHECKLIST.md, docs/security/patterns.md
 */

import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import type {
  AuditCategoryId,
  AuditCategoryResult,
  AuditFinding,
  AuditSeverity,
  SecurityAuditReport,
} from "./securityAuditTypes";

const CATEGORY_NAMES: Record<AuditCategoryId, string> = {
  "CAT-1": "환경변수/시크릿 노출",
  "CAT-2": "인증/인가",
  "CAT-3": "Rate Limiting",
  "CAT-4": "파일 업로드",
  "CAT-5": "스토리지 보안",
  "CAT-6": "Prompt Injection",
  "CAT-7": "정보 노출",
  "CAT-8": "의존성 취약점",
};

const AUTH_MARKERS = [
  "getSession",
  "requireAdminSession",
  "requireAuthenticatedSession",
  "requireTenantSession",
  "assertCaseInTenant",
];

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/password-reset",
  "/api/auth/demo",
  "/api/auth/google",
  "/api/health",
];

const RATE_LIMIT_SENSITIVE = [
  { pattern: /\/api\/ai\//, label: "AI" },
  { pattern: /\/api\/auth\//, label: "Auth" },
  { pattern: /\/api\/messenger\//, label: "Messenger" },
  { pattern: /import-excel|import-preview|\/import/, label: "Import" },
  { pattern: /\/api\/court-case/, label: "Court case" },
  { pattern: /sync-deadlines/, label: "Sync deadlines" },
  { pattern: /\/api\/pdf\//, label: "PDF" },
];

let findingSeq = 0;

function finding(
  category: AuditCategoryId,
  severity: AuditSeverity,
  title: string,
  description: string,
  location?: string,
  recommendation?: string
): AuditFinding {
  findingSeq += 1;
  return {
    id: `F-${findingSeq}`,
    category,
    categoryName: CATEGORY_NAMES[category],
    severity,
    title,
    location,
    description,
    recommendation,
  };
}

async function walkFiles(dir: string, ext: string[]): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string) {
    let entries: string[];
    try {
      entries = await fs.readdir(d);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === "node_modules" || name === ".next" || name === ".git") continue;
      const full = path.join(d, name);
      const st = await fs.stat(full).catch(() => null);
      if (!st) continue;
      if (st.isDirectory()) await walk(full);
      else if (ext.some((e) => name.endsWith(e))) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

function routePathFromFile(root: string, filePath: string): string {
  const rel = path.relative(path.join(root, "src", "app"), filePath).replace(/\\/g, "/");
  const withoutRoute = rel.replace(/\/route\.(ts|js)$/, "");
  return `/api/${withoutRoute.replace(/^api\//, "")}`.replace(/\/+/g, "/");
}

async function auditCat1(root: string): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const gitignore = await fs.readFile(path.join(root, ".gitignore"), "utf8").catch(() => "");
  if (!gitignore.includes(".env")) {
    findings.push(
      finding(
        "CAT-1",
        "CRITICAL",
        ".gitignore에 .env 패턴 누락",
        ".env 파일이 git에 추적될 수 있습니다.",
        ".gitignore"
      )
    );
  }

  const srcFiles = await walkFiles(path.join(root, "src"), [".ts", ".tsx", ".js", ".jsx"]);
  const secretPatterns: { re: RegExp; label: string; severity: AuditSeverity }[] = [
    { re: /sk_live_[a-zA-Z0-9]+/, label: "Stripe live key", severity: "CRITICAL" },
    { re: /sk-[a-zA-Z0-9]{20,}/, label: "API key (sk-)", severity: "CRITICAL" },
    { re: /ghp_[a-zA-Z0-9]+/, label: "GitHub token", severity: "CRITICAL" },
    { re: /AKIA[0-9A-Z]{16}/, label: "AWS access key", severity: "CRITICAL" },
    { re: /NEXT_PUBLIC_.*(SECRET|SERVICE_ROLE|PRIVATE)/i, label: "NEXT_PUBLIC 시크릿", severity: "HIGH" },
  ];

  for (const file of srcFiles) {
    const content = await fs.readFile(file, "utf8").catch(() => "");
    for (const { re, label, severity } of secretPatterns) {
      if (re.test(content)) {
        findings.push(
          finding(
            "CAT-1",
            severity,
            `하드코딩/노출 의심: ${label}`,
            `패턴 ${re.source} 매칭`,
            path.relative(root, file)
          )
        );
      }
    }
  }
  return findings;
}

async function auditCat2(root: string): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const apiDir = path.join(root, "src", "app", "api");
  const routes = await walkFiles(apiDir, [".ts"]);

  for (const file of routes) {
    if (!file.endsWith("route.ts")) continue;
    const route = routePathFromFile(root, file);
    if (PUBLIC_API_PREFIXES.some((p) => route.startsWith(p))) continue;

    const content = await fs.readFile(file, "utf8");
    const hasAuth = AUTH_MARKERS.some((m) => content.includes(m));
    const isAdmin = route.includes("/admin/");

    if (!hasAuth) {
      findings.push(
        finding(
          "CAT-2",
          isAdmin ? "CRITICAL" : "HIGH",
          "API 인증 검사 누락",
          "getSession / require*Session 등 인증 헬퍼가 없습니다.",
          path.relative(root, file),
          "requireAuthenticatedSession 또는 requireTenantSession 추가"
        )
      );
    } else if (isAdmin && !content.includes("requireAdminSession") && !content.includes("requireTenantSession")) {
      findings.push(
        finding(
          "CAT-2",
          "HIGH",
          "Admin API 권한 검증 약함",
          "requireAdminSession 또는 requireTenantSession 권장",
          path.relative(root, file)
        )
      );
    }
  }
  return findings;
}

async function auditCat3(root: string): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const apiDir = path.join(root, "src", "app", "api");
  const routes = await walkFiles(apiDir, [".ts"]);

  for (const file of routes) {
    if (!file.endsWith("route.ts")) continue;
    const route = routePathFromFile(root, file);
    const needsLimit = RATE_LIMIT_SENSITIVE.some(({ pattern }) => pattern.test(route));
    if (!needsLimit) continue;

    const content = await fs.readFile(file, "utf8");
    if (!content.includes("checkRateLimit") && !content.includes("enforceRateLimit")) {
      findings.push(
        finding(
          "CAT-3",
          "HIGH",
          "Rate limit 미적용",
          "비용·브루트포스 위험 엔드포인트에 rate limit 없음",
          path.relative(root, file),
          "enforceRateLimit(request, key, limit) 사용"
        )
      );
    } else if (content.includes("checkRateLimit") && !content.includes("enforceRateLimit")) {
      findings.push(
        finding(
          "CAT-3",
          "MEDIUM",
          "Rate limit — SOC 미연동",
          "checkRateLimit만 사용 중. enforceRateLimit로 security_events 기록 권장",
          path.relative(root, file)
        )
      );
    }
  }
  return findings;
}

async function auditCat4(root: string): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const apiDir = path.join(root, "src", "app", "api");
  const routes = await walkFiles(apiDir, [".ts"]);

  for (const file of routes) {
    if (!file.endsWith("route.ts")) continue;
    const content = await fs.readFile(file, "utf8");
    if (!content.includes("formData") && !content.includes("multipart")) continue;

    const hasSize = /maxSize|sizeLimit|MAX_.*SIZE|file\.size|5\s*\*\s*1024/i.test(content);
    const hasMime = /mime|mimetype|magic|allowedExt|whitelist|\.xlsx/i.test(content);

    if (!hasSize) {
      findings.push(
        finding("CAT-4", "HIGH", "업로드 크기 제한 없음", "file.size 상한 검증 권장", path.relative(root, file))
      );
    }
    if (!hasMime) {
      findings.push(
        finding("CAT-4", "HIGH", "업로드 MIME/확장자 검증 없음", "서버 측 화이트리스트 권장", path.relative(root, file))
      );
    }
  }
  return findings;
}

async function auditCat5(root: string): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const files = await walkFiles(path.join(root, "src"), [".ts", ".tsx"]);
  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    if (content.includes("getPublicUrl") && file.includes("components")) {
      findings.push(
        finding(
          "CAT-5",
          "HIGH",
          "클라이언트에서 getPublicUrl 사용",
          "민감 파일 퍼블릭 URL 노출 가능",
          path.relative(root, file),
          "서명 URL 또는 서버 프록시 사용"
        )
      );
    }
  }
  return findings;
}

async function auditCat6(root: string): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const aiFiles = await walkFiles(path.join(root, "src", "app", "api", "ai"), [".ts"]);
  for (const file of aiFiles) {
    const content = await fs.readFile(file, "utf8");
    const hasSystem = content.includes("systemInstruction") || content.includes("SYSTEM_HINT");
    const hasMaxLen = content.includes("MAX_PROMPT") || content.includes("32000");
    if (!hasSystem) {
      findings.push(
        finding("CAT-6", "MEDIUM", "AI system/user 분리 미흡", "systemInstruction 분리 권장", path.relative(root, file))
      );
    }
    if (!hasMaxLen) {
      findings.push(
        finding("CAT-6", "MEDIUM", "AI 입력 길이 상한 없음", "MAX_PROMPT_LENGTH 권장", path.relative(root, file))
      );
    }
  }
  return findings;
}

async function auditCat7(root: string): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const nextConfig = await fs.readFile(path.join(root, "next.config.ts"), "utf8").catch(() => "");
  const headers = ["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options"];
  for (const h of headers) {
    if (!nextConfig.includes(h)) {
      findings.push(
        finding("CAT-7", "MEDIUM", `보안 헤더 누락: ${h}`, "next.config.ts headers()에 추가", "next.config.ts")
      );
    }
  }

  const routes = await walkFiles(path.join(root, "src", "app", "api"), [".ts"]);
  for (const file of routes) {
    const content = await fs.readFile(file, "utf8");
    if (/error\.stack|err\.stack|\.stack\s*\)/.test(content)) {
      findings.push(
        finding("CAT-7", "MEDIUM", "스택 트레이스 노출 가능", "API 응답에 stack 포함 여부 확인", path.relative(root, file))
      );
    }
  }
  return findings;
}

async function auditCat8(root: string): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const lockExists = await fs.stat(path.join(root, "package-lock.json")).catch(() => null);
  if (!lockExists) {
    findings.push(finding("CAT-8", "MEDIUM", "package-lock.json 없음", "의존성 잠금 파일 권장", "package.json"));
  }

  try {
    const out = execSync("npm audit --json", { cwd: root, encoding: "utf8", timeout: 60000 });
    const json = JSON.parse(out) as {
      metadata?: { vulnerabilities?: { critical?: number; high?: number; moderate?: number; low?: number } };
    };
    const v = json.metadata?.vulnerabilities;
    if (v?.critical && v.critical > 0) {
      findings.push(
        finding("CAT-8", "HIGH", `npm audit critical ${v.critical}건`, "npm audit fix 또는 패키지 업데이트", "package-lock.json")
      );
    }
    if (v?.high && v.high > 0) {
      findings.push(
        finding("CAT-8", "MEDIUM", `npm audit high ${v.high}건`, "의존성 업데이트 검토", "package-lock.json")
      );
    }
  } catch {
    findings.push(
      finding("CAT-8", "LOW", "npm audit 실행 불가", "로컬/CI에서 npm audit 수동 실행", "package-lock.json")
    );
  }
  return findings;
}

function buildSummary(findings: AuditFinding[]): SecurityAuditReport["summary"] {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, total: findings.length };
  for (const f of findings) {
    if (f.severity === "CRITICAL") summary.critical += 1;
    else if (f.severity === "HIGH") summary.high += 1;
    else if (f.severity === "MEDIUM") summary.medium += 1;
    else summary.low += 1;
  }
  return summary;
}

function toMarkdown(report: SecurityAuditReport): string {
  const lines = [
    "# 보안 감사 리포트 (fireauto 8CAT)",
    "",
    `**점검일:** ${report.scannedAt}`,
    `**프로젝트:** ${report.projectRoot}`,
    "",
    "## 요약",
    "",
    "| 심각도 | 건수 |",
    "|--------|------|",
    `| CRITICAL | ${report.summary.critical} |`,
    `| HIGH | ${report.summary.high} |`,
    `| MEDIUM | ${report.summary.medium} |`,
    `| LOW | ${report.summary.low} |`,
    `| **총계** | **${report.summary.total}** |`,
    "",
  ];

  for (const cat of report.categories) {
    lines.push(`## ${cat.id}: ${cat.name}`, "");
    if (cat.findings.length === 0) {
      lines.push("✅ 이슈 없음", "");
      continue;
    }
    for (const f of cat.findings) {
      lines.push(`### [${f.severity}] ${f.title}`);
      if (f.location) lines.push(`- **위치:** \`${f.location}\``);
      lines.push(`- ${f.description}`);
      if (f.recommendation) lines.push(`- **권장:** ${f.recommendation}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export async function runSecurityAudit(projectRoot?: string): Promise<SecurityAuditReport> {
  findingSeq = 0;
  const root = projectRoot ?? process.cwd();

  const runners: { id: AuditCategoryId; fn: (r: string) => Promise<AuditFinding[]> }[] = [
    { id: "CAT-1", fn: auditCat1 },
    { id: "CAT-2", fn: auditCat2 },
    { id: "CAT-3", fn: auditCat3 },
    { id: "CAT-4", fn: auditCat4 },
    { id: "CAT-5", fn: auditCat5 },
    { id: "CAT-6", fn: auditCat6 },
    { id: "CAT-7", fn: auditCat7 },
    { id: "CAT-8", fn: auditCat8 },
  ];

  const categories: AuditCategoryResult[] = [];
  const allFindings: AuditFinding[] = [];

  for (const { id, fn } of runners) {
    const catFindings = await fn(root);
    allFindings.push(...catFindings);
    categories.push({
      id,
      name: CATEGORY_NAMES[id],
      findings: catFindings,
      passed: catFindings.length === 0,
    });
  }

  const summary = buildSummary(allFindings);
  return {
    projectRoot: root,
    scannedAt: new Date().toISOString(),
    categories,
    summary,
    findings: allFindings,
  };
}

export function auditReportToMarkdown(report: SecurityAuditReport): string {
  return toMarkdown(report);
}

export async function saveAuditRun(
  triggeredBy: string,
  report: SecurityAuditReport
): Promise<string | null> {
  const { getSupabaseAdmin } = await import("@/lib/supabaseClient");
  const db = getSupabaseAdmin();
  if (!db) return null;

  const markdown = auditReportToMarkdown(report);
  const { data, error } = await db
    .from("security_audit_runs")
    .insert({
      triggered_by: triggeredBy,
      summary: report.summary,
      findings: report.findings,
      report_markdown: markdown,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[security_audit_run]", error.message);
    return null;
  }
  return (data as { id: string }).id;
}

export async function listAuditRuns(limit = 10) {
  const { getSupabaseAdmin } = await import("@/lib/supabaseClient");
  const db = getSupabaseAdmin();
  if (!db) return [];

  const { data, error } = await db
    .from("security_audit_runs")
    .select("id, triggered_by, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data ?? [];
}

export async function getAuditRun(id: string) {
  const { getSupabaseAdmin } = await import("@/lib/supabaseClient");
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db.from("security_audit_runs").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data;
}
