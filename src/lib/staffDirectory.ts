/**
 * 직원·변호사 목록 — /api/staff (승인된 site_users) 연동
 */

export type StaffDirectoryEntry = {
  id: string;
  name: string;
  role: string;
  department: string;
};

export const LAWYER_ROLES = new Set(["변호사", "임원", "국장"]);
export const EXCLUDED_STAFF_ROLES = new Set(["인턴", "사무원"]);

export function splitStaffByRole(staff: StaffDirectoryEntry[]): {
  lawyers: StaffDirectoryEntry[];
  employees: StaffDirectoryEntry[];
} {
  const eligible = staff.filter(
    (s) => s.name.trim() && !EXCLUDED_STAFF_ROLES.has(s.role)
  );
  const lawyers = eligible.filter((s) => LAWYER_ROLES.has(s.role));
  const employees = eligible.filter((s) => !LAWYER_ROLES.has(s.role));
  const sortByName = (a: StaffDirectoryEntry, b: StaffDirectoryEntry) =>
    a.name.localeCompare(b.name, "ko");
  return {
    lawyers: [...lawyers].sort(sortByName),
    employees: [...employees].sort(sortByName),
  };
}

export function filterStaffByQuery(
  list: StaffDirectoryEntry[],
  query: string
): StaffDirectoryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q)
  );
}

export async function fetchStaffDirectory(): Promise<{
  staff: StaffDirectoryEntry[];
  error?: string;
}> {
  const res = await fetch("/api/staff", { credentials: "include", cache: "no-store" });
  const json = (await res.json()) as {
    staff?: Array<{
      id: string;
      name?: string;
      role?: string;
      department?: string;
    }>;
    error?: string;
  };
  if (!res.ok) {
    return { staff: [], error: json.error ?? "직원 목록을 불러오지 못했습니다." };
  }
  const staff = (json.staff ?? []).map((s) => ({
    id: String(s.id),
    name: (s.name ?? "").trim(),
    role: (s.role ?? "직원").trim(),
    department: (s.department ?? "").trim(),
  }));
  return { staff, error: json.error };
}
