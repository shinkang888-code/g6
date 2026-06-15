/**
 * 고객 엑셀 import 계획 (LawTop guestlist — 중복 검사·미리보기)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export type ClientDbRow = {
  name: string;
  position: string | null;
  contact_phone: string | null;
  contact_mobile: string | null;
  contact_email: string | null;
  memo: string | null;
  address: string | null;
  guest_code: string | null;
  id_number: string | null;
  biz_number: string | null;
};

export type ClientImportRowStatus = "insert" | "duplicate_db" | "duplicate_batch" | "invalid";

export type ClientImportPlanRow = {
  excelRow: number;
  name: string;
  guestCode: string;
  phone: string;
  status: ClientImportRowStatus;
  reason: string;
  item: ClientDbRow | null;
};

export type ClientImportPlan = {
  rows: ClientImportPlanRow[];
  toInsert: ClientDbRow[];
  summary: {
    total: number;
    insert: number;
    duplicateDb: number;
    duplicateBatch: number;
    invalid: number;
  };
};

function getCell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

export function parseClientExcelBuffer(buffer: Buffer): {
  rows: Record<string, unknown>[];
  isGuestlist: boolean;
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows: [], isGuestlist: false };
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const headers = Object.keys(rows[0] ?? {});
  const isGuestlist = headers.includes("의뢰인명");
  return { rows, isGuestlist };
}

export function rowToDbClient(row: Record<string, unknown>, isGuestlist: boolean): ClientDbRow | null {
  if (isGuestlist) {
    const name = getCell(row, "의뢰인명");
    if (!name) return null;
    const mobile = getCell(row, "이동전화");
    const landline = getCell(row, "전화");
    const memoParts = [
      getCell(row, "비고"),
      getCell(row, "구분") ? `구분: ${getCell(row, "구분")}` : "",
      getCell(row, "담당자명") ? `담당: ${getCell(row, "담당자명")}` : "",
      getCell(row, "사건번호") ? `사건번호: ${getCell(row, "사건번호")}` : "",
      getCell(row, "사건명") ? `사건명: ${getCell(row, "사건명")}` : "",
    ].filter(Boolean);
    return {
      name,
      position: getCell(row, "직위") || null,
      contact_mobile: mobile || landline || null,
      contact_phone: landline || mobile || null,
      contact_email: getCell(row, "이메일") || null,
      memo: memoParts.join(" / ").slice(0, 2000) || null,
      address: getCell(row, "주소") || null,
      guest_code: getCell(row, "고유번호") || null,
      id_number: null,
      biz_number: null,
    };
  }
  const name = getCell(row, "의뢰인");
  if (!name) return null;
  const landline = getCell(row, "연락처");
  const mobile = getCell(row, "휴대폰");
  return {
    name,
    position: null,
    contact_phone: landline || mobile || null,
    contact_mobile: mobile || landline || null,
    contact_email: getCell(row, "이메일") || null,
    memo: getCell(row, "메모") || null,
    address: getCell(row, "주소") || null,
    guest_code: null,
    id_number: getCell(row, "주민번호") || null,
    biz_number: getCell(row, "사업자번호") || null,
  };
}

function normKey(name: string, phone: string): string {
  const p = phone.replace(/\D/g, "");
  return `${name.trim().toLowerCase()}|${p}`;
}

export async function loadExistingClientKeys(db: SupabaseClient) {
  const { data } = await db
    .from("clients")
    .select("guest_code, name, contact_phone, contact_mobile")
    .is("deleted_at", null);
  const guestCodes = new Set<string>();
  const namePhone = new Set<string>();
  for (const r of data ?? []) {
    const gc = String(r.guest_code ?? "").trim();
    if (gc) guestCodes.add(gc);
    const phone = String(r.contact_mobile ?? r.contact_phone ?? "");
    namePhone.add(normKey(String(r.name ?? ""), phone));
  }
  return { guestCodes, namePhone };
}

export function planClientImport(
  excelRows: Record<string, unknown>[],
  isGuestlist: boolean,
  existing: { guestCodes: Set<string>; namePhone: Set<string> }
): ClientImportPlan {
  const planRows: ClientImportPlanRow[] = [];
  const toInsert: ClientDbRow[] = [];
  const batchGuest = new Set<string>();
  const batchNamePhone = new Set<string>();

  let excelRow = 1;
  for (const row of excelRows) {
    excelRow += 1;
    const item = rowToDbClient(row, isGuestlist);
    if (!item) continue;

    const guestCode = item.guest_code ?? "";
    const phone = item.contact_mobile ?? item.contact_phone ?? "";
    const npKey = normKey(item.name, phone);

    if (guestCode && existing.guestCodes.has(guestCode)) {
      planRows.push({
        excelRow,
        name: item.name,
        guestCode,
        phone,
        status: "duplicate_db",
        reason: "DB에 동일 고유번호가 있습니다.",
        item: null,
      });
      continue;
    }
    if (existing.namePhone.has(npKey)) {
      planRows.push({
        excelRow,
        name: item.name,
        guestCode,
        phone,
        status: "duplicate_db",
        reason: "DB에 동일 의뢰인·연락처가 있습니다.",
        item: null,
      });
      continue;
    }
    if (guestCode && batchGuest.has(guestCode)) {
      planRows.push({
        excelRow,
        name: item.name,
        guestCode,
        phone,
        status: "duplicate_batch",
        reason: "엑셀 내 고유번호 중복",
        item: null,
      });
      continue;
    }
    if (batchNamePhone.has(npKey)) {
      planRows.push({
        excelRow,
        name: item.name,
        guestCode,
        phone,
        status: "duplicate_batch",
        reason: "엑셀 내 의뢰인·연락처 중복",
        item: null,
      });
      continue;
    }

    if (guestCode) batchGuest.add(guestCode);
    batchNamePhone.add(npKey);
    planRows.push({
      excelRow,
      name: item.name,
      guestCode,
      phone,
      status: "insert",
      reason: "신규 등록",
      item,
    });
    toInsert.push(item);
  }

  const summary = {
    total: planRows.length,
    insert: planRows.filter((r) => r.status === "insert").length,
    duplicateDb: planRows.filter((r) => r.status === "duplicate_db").length,
    duplicateBatch: planRows.filter((r) => r.status === "duplicate_batch").length,
    invalid: planRows.filter((r) => r.status === "invalid").length,
  };

  return { rows: planRows, toInsert, summary };
}

export async function insertClientImportRows(db: SupabaseClient, rows: ClientDbRow[]): Promise<number> {
  const chunk = 80;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await db.from("clients").insert(slice);
    if (error) throw new Error(error.message);
    inserted += slice.length;
  }
  return inserted;
}
