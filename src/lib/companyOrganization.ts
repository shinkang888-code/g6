/**
 * 회사(관리번호) 하위 조직 폴더 CRUD + 구성원 배치
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SiteUserRow } from "@/lib/userAdmin";

export type CompanyOrganizationRow = {
  id: string;
  management_number: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationTreeNode = CompanyOrganizationRow & {
  memberCount: number;
  children: OrganizationTreeNode[];
};

const ORG_SELECT = "id, management_number, parent_id, name, sort_order, memo, created_at, updated_at";

export async function ensureDefaultOrganization(db: SupabaseClient, managementNumber: string): Promise<void> {
  const { data: existing } = await db
    .from("company_organizations")
    .select("id")
    .eq("management_number", managementNumber)
    .eq("name", "본사")
    .is("parent_id", null)
    .maybeSingle();

  if (existing) return;

  await db.from("company_organizations").insert({
    management_number: managementNumber,
    parent_id: null,
    name: "본사",
    sort_order: 0,
  });
}

export async function listOrganizationsFlat(
  db: SupabaseClient,
  managementNumber: string
): Promise<CompanyOrganizationRow[]> {
  await ensureDefaultOrganization(db, managementNumber);

  const { data, error } = await db
    .from("company_organizations")
    .select(ORG_SELECT)
    .eq("management_number", managementNumber)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CompanyOrganizationRow[];
}

export async function buildOrganizationTree(
  db: SupabaseClient,
  managementNumber: string
): Promise<OrganizationTreeNode[]> {
  const flat = await listOrganizationsFlat(db, managementNumber);

  const { data: members } = await db
    .from("site_users")
    .select("id, organization_id")
    .eq("management_number", managementNumber);

  const countByOrg = new Map<string, number>();
  let unassigned = 0;
  for (const m of members ?? []) {
    const oid = m.organization_id as string | null;
    if (!oid) {
      unassigned += 1;
      continue;
    }
    countByOrg.set(oid, (countByOrg.get(oid) ?? 0) + 1);
  }

  const nodeMap = new Map<string, OrganizationTreeNode>();
  for (const row of flat) {
    nodeMap.set(row.id, {
      ...row,
      memberCount: countByOrg.get(row.id) ?? 0,
      children: [],
    });
  }

  const roots: OrganizationTreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  roots.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ko"));
  for (const n of nodeMap.values()) {
    n.children.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ko"));
  }

  return roots;
}

export async function createOrganization(
  db: SupabaseClient,
  input: {
    managementNumber: string;
    name: string;
    parentId?: string | null;
    memo?: string;
    sortOrder?: number;
  }
): Promise<{ ok: true; organization: CompanyOrganizationRow } | { ok: false; error: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "조직명을 입력하세요." };

  await ensureDefaultOrganization(db, input.managementNumber);

  if (input.parentId) {
    const { data: parent } = await db
      .from("company_organizations")
      .select("id, management_number")
      .eq("id", input.parentId)
      .maybeSingle();
    if (!parent || parent.management_number !== input.managementNumber) {
      return { ok: false, error: "상위 조직이 올바르지 않습니다." };
    }
  }

  const { data, error } = await db
    .from("company_organizations")
    .insert({
      management_number: input.managementNumber,
      parent_id: input.parentId ?? null,
      name,
      memo: (input.memo ?? "").trim() || null,
      sort_order: input.sortOrder ?? 0,
    })
    .select(ORG_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "같은 이름의 조직이 이미 있습니다." };
    return { ok: false, error: error.message };
  }

  return { ok: true, organization: data as CompanyOrganizationRow };
}

export async function updateOrganization(
  db: SupabaseClient,
  organizationId: string,
  managementNumber: string,
  input: { name?: string; parentId?: string | null; memo?: string; sortOrder?: number }
): Promise<{ ok: true; organization: CompanyOrganizationRow } | { ok: false; error: string }> {
  const { data: current } = await db
    .from("company_organizations")
    .select(ORG_SELECT)
    .eq("id", organizationId)
    .eq("management_number", managementNumber)
    .maybeSingle();

  if (!current) return { ok: false, error: "조직을 찾을 수 없습니다." };

  if (input.parentId !== undefined && input.parentId) {
    if (input.parentId === organizationId) {
      return { ok: false, error: "자기 자신을 상위 조직으로 지정할 수 없습니다." };
    }
    const { data: parent } = await db
      .from("company_organizations")
      .select("id, management_number")
      .eq("id", input.parentId)
      .maybeSingle();
    if (!parent || parent.management_number !== managementNumber) {
      return { ok: false, error: "상위 조직이 올바르지 않습니다." };
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "조직명을 입력하세요." };
    patch.name = name;
  }
  if (input.parentId !== undefined) patch.parent_id = input.parentId;
  if (input.memo !== undefined) patch.memo = input.memo.trim() || null;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const { data, error } = await db
    .from("company_organizations")
    .update(patch)
    .eq("id", organizationId)
    .eq("management_number", managementNumber)
    .select(ORG_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "같은 이름의 조직이 이미 있습니다." };
    return { ok: false, error: error.message };
  }

  return { ok: true, organization: data as CompanyOrganizationRow };
}

export async function deleteOrganization(
  db: SupabaseClient,
  organizationId: string,
  managementNumber: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: org } = await db
    .from("company_organizations")
    .select("id, name")
    .eq("id", organizationId)
    .eq("management_number", managementNumber)
    .maybeSingle();

  if (!org) return { ok: false, error: "조직을 찾을 수 없습니다." };
  if (org.name === "본사") {
    return { ok: false, error: "기본 조직 '본사'는 삭제할 수 없습니다." };
  }

  const { count: childCount } = await db
    .from("company_organizations")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", organizationId);

  if ((childCount ?? 0) > 0) {
    return { ok: false, error: "하위 조직이 있어 삭제할 수 없습니다. 하위 조직을 먼저 삭제하세요." };
  }

  await db
    .from("site_users")
    .update({ organization_id: null, department: null })
    .eq("organization_id", organizationId);

  const { error } = await db
    .from("company_organizations")
    .delete()
    .eq("id", organizationId)
    .eq("management_number", managementNumber);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const MEMBER_SELECT =
  "id, login_id, management_number, status, name, role, department, email, phone, organization_id, permission_role_id, created_at, google_email, auth_provider";

export async function listOrganizationMembers(
  db: SupabaseClient,
  managementNumber: string,
  filter?: { organizationId?: string | null; includeAll?: boolean }
): Promise<SiteUserRow[]> {
  let query = db.from("site_users").select(MEMBER_SELECT).eq("management_number", managementNumber);

  if (!filter?.includeAll) {
    if (filter?.organizationId === null) {
      query = query.is("organization_id", null);
    } else if (filter?.organizationId) {
      query = query.eq("organization_id", filter.organizationId);
    }
  }

  const { data, error } = await query.order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SiteUserRow[];
}

export async function assignMemberOrganization(
  db: SupabaseClient,
  managementNumber: string,
  userId: string,
  organizationId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: user } = await db
    .from("site_users")
    .select("id, management_number")
    .eq("id", userId)
    .maybeSingle();

  if (!user || user.management_number !== managementNumber) {
    return { ok: false, error: "해당 회사 구성원이 아닙니다." };
  }

  let department: string | null = null;
  if (organizationId) {
    const { data: org } = await db
      .from("company_organizations")
      .select("id, name, management_number")
      .eq("id", organizationId)
      .maybeSingle();
    if (!org || org.management_number !== managementNumber) {
      return { ok: false, error: "조직을 찾을 수 없습니다." };
    }
    department = org.name;
  }

  const { error } = await db
    .from("site_users")
    .update({ organization_id: organizationId, department })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
