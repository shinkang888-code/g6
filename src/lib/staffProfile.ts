/**
 * site_users.profile JSONB — 직원 부가 정보 (직급, 회사폰, 개인폰)
 */

import type { JobTitleOption } from "@/lib/types";

export type StaffProfileExtra = {
  jobTitle?: JobTitleOption;
  companyPhone?: string;
  personalPhone?: string;
};

const JOB_TITLES = new Set(["부장", "팀장", "과장", "대리", "주임", "인턴"]);

export function parseStaffProfile(profile: unknown): StaffProfileExtra {
  if (!profile || typeof profile !== "object") return {};
  const p = profile as Record<string, unknown>;
  const jobTitleRaw = String(p.jobTitle ?? p.job_title ?? "").trim();
  const jobTitle = JOB_TITLES.has(jobTitleRaw) ? (jobTitleRaw as JobTitleOption) : undefined;
  return {
    jobTitle,
    companyPhone: String(p.companyPhone ?? p.company_phone ?? "").trim() || undefined,
    personalPhone: String(p.personalPhone ?? p.personal_phone ?? "").trim() || undefined,
  };
}

export function mergeStaffProfile(
  existing: unknown,
  patch: StaffProfileExtra
): Record<string, string> {
  const base = parseStaffProfile(existing);
  const next: Record<string, string> = {};
  const jobTitle = patch.jobTitle ?? base.jobTitle;
  const companyPhone = patch.companyPhone ?? base.companyPhone;
  const personalPhone = patch.personalPhone ?? base.personalPhone;
  if (jobTitle) next.jobTitle = jobTitle;
  if (companyPhone) next.companyPhone = companyPhone;
  if (personalPhone) next.personalPhone = personalPhone;
  return next;
}

export function primaryPhoneFromStaffFields(
  phone: string | null | undefined,
  extra: StaffProfileExtra
): string {
  return extra.companyPhone || extra.personalPhone || (phone ?? "").trim() || "";
}
