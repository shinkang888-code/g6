/**
 * 상담·상담실 Supabase 서비스 (LawBoard Phase 1)
 */

import { getSupabaseAdmin } from "@/lib/supabaseClient";
import type { ConsultationItem, ConsultationRoom, ConsultationStatus } from "@/lib/types";

export type ConsultationMeta = {
  startTime?: string;
  endTime?: string;
  roomId?: string;
  roomName?: string;
  consultantId?: string;
  consultantName?: string;
  consultants?: { id: string; name: string }[];
  clientNames?: string[];
  purpose?: string;
  importance?: "high" | "medium" | "low";
  status?: ConsultationStatus;
  caseId?: string;
  caseNumber?: string;
  notes?: string;
};

function fromRow(row: Record<string, unknown>): ConsultationItem {
  const meta = (row.meta as ConsultationMeta) ?? {};
  const consultants = meta.consultants?.length
    ? meta.consultants
    : meta.consultantId
      ? [{ id: meta.consultantId, name: meta.consultantName ?? "" }]
      : undefined;
  const clientNames = meta.clientNames?.length
    ? meta.clientNames
    : row.client_name
      ? [String(row.client_name)]
      : undefined;
  return {
    id: String(row.id),
    consultationDate: String(row.consultation_date).slice(0, 10),
    startTime: meta.startTime ?? "09:00",
    endTime: meta.endTime ?? "09:30",
    roomId: meta.roomId ?? "",
    roomName: meta.roomName ?? "",
    consultantId: consultants?.[0]?.id ?? meta.consultantId ?? "",
    consultantName: consultants?.[0]?.name ?? meta.consultantName ?? "",
    consultants,
    clientName: clientNames?.[0] ?? String(row.client_name ?? ""),
    clientNames,
    purpose: meta.purpose ?? "",
    importance: meta.importance ?? "medium",
    status: meta.status ?? "scheduled",
    caseId: meta.caseId,
    caseNumber: meta.caseNumber,
    notes: meta.notes ?? (row.notes ? String(row.notes) : undefined),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toMeta(input: Partial<ConsultationItem>): ConsultationMeta {
  return {
    startTime: input.startTime,
    endTime: input.endTime,
    roomId: input.roomId,
    roomName: input.roomName,
    consultantId: input.consultantId,
    consultantName: input.consultantName,
    consultants: input.consultants,
    clientNames: input.clientNames,
    purpose: input.purpose,
    importance: input.importance,
    status: input.status,
    caseId: input.caseId,
    caseNumber: input.caseNumber,
    notes: input.notes,
  };
}

async function useDb(): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db.from("consultations").select("id").limit(1);
  return !error;
}

export async function listConsultations(options?: {
  date?: string;
  q?: string;
}): Promise<ConsultationItem[]> {
  if (!(await useDb())) return [];

  const db = getSupabaseAdmin()!;
  let query = db
    .from("consultations")
    .select("*")
    .is("deleted_at", null)
    .order("consultation_date", { ascending: false });

  if (options?.date) {
    query = query.eq("consultation_date", options.date);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let items = (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
  const q = options?.q?.trim().toLowerCase();
  if (q) {
    items = items.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        c.purpose.toLowerCase().includes(q) ||
        c.consultantName.toLowerCase().includes(q) ||
        (c.notes?.toLowerCase().includes(q) ?? false)
    );
  }
  return items;
}

export async function createConsultation(
  input: Partial<ConsultationItem>
): Promise<ConsultationItem> {
  if (!(await useDb())) throw new Error("Supabase가 설정되지 않았습니다.");

  const now = new Date().toISOString();
  const clientName =
    input.clientNames?.[0] ?? input.clientName ?? "미상";
  const db = getSupabaseAdmin()!;
  const { data, error } = await db
    .from("consultations")
    .insert({
      client_name: clientName,
      consultation_date: input.consultationDate,
      notes: input.notes ?? input.purpose ?? "",
      meta: toMeta(input),
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return fromRow(data as Record<string, unknown>);
}

export async function updateConsultation(
  id: string,
  input: Partial<ConsultationItem>
): Promise<ConsultationItem | null> {
  if (!(await useDb())) throw new Error("Supabase가 설정되지 않았습니다.");

  const existing = await getConsultationById(id);
  if (!existing) return null;

  const merged: ConsultationItem = { ...existing, ...input, id };
  const now = new Date().toISOString();
  const db = getSupabaseAdmin()!;
  const { data, error } = await db
    .from("consultations")
    .update({
      client_name: merged.clientNames?.[0] ?? merged.clientName,
      consultation_date: merged.consultationDate,
      notes: merged.notes ?? merged.purpose ?? "",
      meta: toMeta(merged),
      updated_at: now,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? fromRow(data as Record<string, unknown>) : null;
}

export async function getConsultationById(id: string): Promise<ConsultationItem | null> {
  if (!(await useDb())) return null;
  const db = getSupabaseAdmin()!;
  const { data, error } = await db
    .from("consultations")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data as Record<string, unknown>) : null;
}

export async function softDeleteConsultation(id: string): Promise<boolean> {
  if (!(await useDb())) return false;
  const now = new Date().toISOString();
  const db = getSupabaseAdmin()!;
  const { error } = await db
    .from("consultations")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id);
  return !error;
}

function roomFromRow(row: Record<string, unknown>): ConsultationRoom {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    remarks: row.remarks ? String(row.remarks) : undefined,
  };
}

export async function listConsultationRooms(): Promise<ConsultationRoom[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from("consultation_rooms")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => roomFromRow(r as Record<string, unknown>));
}

export async function createConsultationRoom(
  input: Partial<ConsultationRoom>
): Promise<ConsultationRoom> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("Supabase가 설정되지 않았습니다.");
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("consultation_rooms")
    .insert({
      name: input.name?.trim() ?? "상담실",
      sort_order: input.sortOrder ?? 0,
      remarks: input.remarks ?? null,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return roomFromRow(data as Record<string, unknown>);
}

export async function updateConsultationRoom(
  id: string,
  input: Partial<ConsultationRoom>
): Promise<ConsultationRoom | null> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("Supabase가 설정되지 않았습니다.");
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;
  if (input.remarks !== undefined) update.remarks = input.remarks;
  const { data, error } = await db
    .from("consultation_rooms")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? roomFromRow(data as Record<string, unknown>) : null;
}

export async function softDeleteConsultationRoom(id: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const now = new Date().toISOString();
  const { error } = await db
    .from("consultation_rooms")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id);
  return !error;
}
