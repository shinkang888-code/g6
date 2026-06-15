/**
 * Vercel 환경 변수 vs DB 설정 우선순위
 * preferDbOverEnv=true 이면 UI에서 교체한 DB 값이 env보다 우선
 */

export function resolveEnvOrDbValue(
  envValue: string | undefined,
  dbValue: string | undefined,
  preferDbOverEnv?: boolean
): string | undefined {
  const env = envValue?.trim() || undefined;
  const db = dbValue?.trim() || undefined;
  if (preferDbOverEnv && db) return db;
  return env || db;
}
