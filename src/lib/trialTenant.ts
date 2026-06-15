/**
 * 체험판(관리번호 10000) 테넌트 식별
 */

import { normalizeManagementNumber } from "@/lib/managementNumber";

/** LawTop 체험판 관리번호 */
export const TRIAL_MANAGEMENT_NUMBER = "10000";

export function isTrialManagementNumber(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const normalized = normalizeManagementNumber(raw);
  return normalized === TRIAL_MANAGEMENT_NUMBER;
}
