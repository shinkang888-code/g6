/**
 * 고객 API ↔ ClientItem 매핑 (LawTop guestlist 필드 정합)
 */

import type { ClientItem } from "@/lib/types";

export function clientFromRow(r: Record<string, unknown>): ClientItem {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    phone: (r.contact_phone as string) ?? undefined,
    mobile: (r.contact_mobile as string) ?? (r.contact_phone as string) ?? undefined,
    email: (r.contact_email as string) ?? undefined,
    address: (r.address as string) ?? undefined,
    position: (r.position as string) ?? undefined,
    guestCode: (r.guest_code as string) ?? undefined,
    idNumber: (r.id_number as string) ?? undefined,
    bizNumber: (r.biz_number as string) ?? undefined,
    memo: (r.memo as string) ?? undefined,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
    deletedAt: r.deleted_at ? String(r.deleted_at) : undefined,
  };
}

export function clientToRow(
  body: Record<string, unknown>,
  managementNumber?: string
): Record<string, unknown> | null {
  const name = String(body.name ?? "").trim();
  if (!name) return null;
  const landline = String(body.phone ?? "").trim() || null;
  const mobile = String(body.mobile ?? "").trim() || null;
  const mgmt = (managementNumber ?? body.managementNumber ?? body.management_number ?? "").toString().trim();
  return {
    name,
    position: body.position ? String(body.position).trim() : null,
    contact_phone: landline ?? mobile,
    contact_mobile: mobile ?? landline,
    contact_email: body.email ? String(body.email).trim() : null,
    memo: body.memo ? String(body.memo).trim() : null,
    address: body.address ? String(body.address).trim() : null,
    guest_code: body.guestCode ? String(body.guestCode).trim() : null,
    id_number: body.idNumber ? String(body.idNumber).trim() : null,
    biz_number: body.bizNumber ? String(body.bizNumber).trim() : null,
    updated_at: new Date().toISOString(),
    ...(mgmt ? { management_number: mgmt } : {}),
  };
}

export type FetchClientsParams = {
  q?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
};

export function buildClientsQueryString(params: FetchClientsParams): string {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.includeDeleted) sp.set("include_deleted", "true");
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("page_size", String(params.pageSize));
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
