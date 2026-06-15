/**
 * 사건 담당/보조 일괄변경 (LawTop 사건담당 일괄변경 MVP)
 */

export type BulkStaffRole = "수행" | "보조";
export type BulkStaffAction = "교체" | "IN" | "OUT" | "주담당";

export type BulkStaffCaseInput = {
  id: string;
  caseNumber: string;
  caseName: string;
  clientName: string;
  assignedStaff: string;
  assistants: string;
};

export type BulkStaffPlanStatus = "apply" | "skip" | "error";

export type BulkStaffPlanRow = {
  caseId: string;
  caseNumber: string;
  caseName: string;
  clientName: string;
  before: { assignedStaff: string; assistants: string };
  after: { assignedStaff: string; assistants: string };
  status: BulkStaffPlanStatus;
  reason: string;
};

export type BulkStaffPlan = {
  rows: BulkStaffPlanRow[];
  updates: Array<{
    id: string;
    assigned_staff_name: string;
    assistants: string;
  }>;
  summary: {
    total: number;
    apply: number;
    skip: number;
    error: number;
  };
  actionLabel: string;
};

export function parseAssistants(value: string): string[] {
  return value
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinAssistants(names: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const t = n.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.join(", ");
}

function addAssistant(current: string, name: string): string {
  const n = name.trim();
  if (!n) return current;
  return joinAssistants([...parseAssistants(current), n]);
}

function removeAssistant(current: string, name: string): string {
  const n = name.trim();
  return joinAssistants(parseAssistants(current).filter((x) => x !== n));
}

function sameStaff(
  a: { assignedStaff: string; assistants: string },
  b: { assignedStaff: string; assistants: string }
): boolean {
  return (
    a.assignedStaff.trim() === b.assignedStaff.trim() &&
    joinAssistants(parseAssistants(a.assistants)) === joinAssistants(parseAssistants(b.assistants))
  );
}

export function buildBulkStaffActionLabel(
  role: BulkStaffRole,
  action: BulkStaffAction,
  personName: string
): string {
  const name = personName.trim();
  if (action === "주담당") return `주담당 지정 → ${name}`;
  if (role === "수행" && action === "교체") return `수행 담당 교체 → ${name}`;
  if (role === "보조" && action === "IN") return `보조 IN → ${name}`;
  if (role === "보조" && action === "OUT") return `보조 OUT → ${name}`;
  return `${role} ${action} → ${name}`;
}

export function applyBulkStaffToCase(
  row: BulkStaffCaseInput,
  role: BulkStaffRole,
  action: BulkStaffAction,
  personName: string
): { after: { assignedStaff: string; assistants: string }; status: BulkStaffPlanStatus; reason: string } {
  const name = personName.trim();
  if (!name) {
    return {
      after: { assignedStaff: row.assignedStaff, assistants: row.assistants },
      status: "error",
      reason: "대상 인물 이름이 비어 있습니다.",
    };
  }

  const before = {
    assignedStaff: String(row.assignedStaff ?? "").trim(),
    assistants: String(row.assistants ?? "").trim(),
  };

  let after = { ...before };

  if (action === "주담당") {
    const prev = before.assignedStaff;
    let asst = parseAssistants(before.assistants).filter((x) => x !== name);
    if (prev && prev !== name && !asst.includes(prev)) {
      asst.push(prev);
    }
    after = {
      assignedStaff: name,
      assistants: joinAssistants(asst),
    };
  } else if (role === "수행" && action === "교체") {
    after = {
      assignedStaff: name,
      assistants: before.assistants,
    };
  } else if (role === "보조" && action === "IN") {
    if (before.assignedStaff === name) {
      return { after: before, status: "skip", reason: "이미 수행 담당입니다." };
    }
    const list = parseAssistants(before.assistants);
    if (list.includes(name)) {
      return { after: before, status: "skip", reason: "이미 보조에 포함되어 있습니다." };
    }
    after = {
      assignedStaff: before.assignedStaff,
      assistants: addAssistant(before.assistants, name),
    };
  } else if (role === "보조" && action === "OUT") {
    const list = parseAssistants(before.assistants);
    if (!list.includes(name)) {
      return { after: before, status: "skip", reason: "보조 목록에 없습니다." };
    }
    after = {
      assignedStaff: before.assignedStaff,
      assistants: removeAssistant(before.assistants, name),
    };
  } else {
    return {
      after: before,
      status: "error",
      reason: "지원하지 않는 역할·동작 조합입니다.",
    };
  }

  if (!after.assignedStaff.trim()) {
    return {
      after,
      status: "error",
      reason: "수행 담당(주담당)이 비어 있습니다. 최소 1명 필요합니다.",
    };
  }

  if (sameStaff(before, after)) {
    return { after, status: "skip", reason: "변경 사항이 없습니다." };
  }

  return { after, status: "apply", reason: "변경 예정" };
}

export function planBulkStaffChange(
  cases: BulkStaffCaseInput[],
  params: { role: BulkStaffRole; action: BulkStaffAction; personName: string }
): BulkStaffPlan {
  const rows: BulkStaffPlanRow[] = [];
  const updates: BulkStaffPlan["updates"] = [];

  for (const c of cases) {
    const before = {
      assignedStaff: String(c.assignedStaff ?? "").trim(),
      assistants: String(c.assistants ?? "").trim(),
    };
    const result = applyBulkStaffToCase(c, params.role, params.action, params.personName);
    const planRow: BulkStaffPlanRow = {
      caseId: c.id,
      caseNumber: c.caseNumber,
      caseName: c.caseName,
      clientName: c.clientName,
      before,
      after: result.after,
      status: result.status,
      reason: result.reason,
    };
    rows.push(planRow);
    if (result.status === "apply") {
      updates.push({
        id: c.id,
        assigned_staff_name: result.after.assignedStaff,
        assistants: result.after.assistants,
      });
    }
  }

  return {
    rows,
    updates,
    summary: {
      total: rows.length,
      apply: rows.filter((r) => r.status === "apply").length,
      skip: rows.filter((r) => r.status === "skip").length,
      error: rows.filter((r) => r.status === "error").length,
    },
    actionLabel: buildBulkStaffActionLabel(params.role, params.action, params.personName),
  };
}
