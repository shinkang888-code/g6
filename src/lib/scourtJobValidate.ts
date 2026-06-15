import type { ScourtJob } from "@/lib/scourtBot";

export function isValidScourtJob(j: unknown): j is ScourtJob {
  if (!j || typeof j !== "object") return false;
  const o = j as Record<string, unknown>;
  return (
    typeof o.courtName === "string" &&
    typeof o.year === "string" &&
    typeof o.gubun === "string" &&
    typeof o.serial === "string" &&
    typeof o.partyName === "string" &&
    o.courtName.trim() !== "" &&
    o.year.trim() !== "" &&
    o.gubun.trim() !== "" &&
    o.serial.trim() !== "" &&
    o.partyName.trim() !== ""
  );
}
