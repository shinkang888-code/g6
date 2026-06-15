import type { ConsultationItem, ConsultationRoom } from "@/lib/types";

type ApiJson<T> = { success?: boolean; data?: T; error?: string; total?: number };

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiJson<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "요청에 실패했습니다.");
  }
  return json.data as T;
}

export async function fetchConsultations(options?: {
  date?: string;
  q?: string;
}): Promise<ConsultationItem[]> {
  const params = new URLSearchParams();
  if (options?.date) params.set("date", options.date);
  if (options?.q?.trim()) params.set("q", options.q.trim());
  const res = await fetch(`/api/consultations?${params.toString()}`, {
    credentials: "include",
  });
  return parseJson<ConsultationItem[]>(res);
}

export async function createConsultationApi(
  input: Partial<ConsultationItem>
): Promise<ConsultationItem> {
  const res = await fetch("/api/consultations", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<ConsultationItem>(res);
}

export async function updateConsultationApi(
  id: string,
  input: Partial<ConsultationItem>
): Promise<ConsultationItem> {
  const res = await fetch(`/api/consultations/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<ConsultationItem>(res);
}

export async function deleteConsultationApi(id: string): Promise<void> {
  const res = await fetch(`/api/consultations/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await parseJson<{ ok: boolean }>(res);
}

export async function fetchConsultationRooms(): Promise<ConsultationRoom[]> {
  const res = await fetch("/api/consultation-rooms", { credentials: "include" });
  return parseJson<ConsultationRoom[]>(res);
}

export async function createConsultationRoomApi(
  input: Partial<ConsultationRoom>
): Promise<ConsultationRoom> {
  const res = await fetch("/api/consultation-rooms", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<ConsultationRoom>(res);
}

export async function updateConsultationRoomApi(
  id: string,
  input: Partial<ConsultationRoom>
): Promise<ConsultationRoom> {
  const res = await fetch(`/api/consultation-rooms/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<ConsultationRoom>(res);
}

export async function deleteConsultationRoomApi(id: string): Promise<void> {
  const res = await fetch(`/api/consultation-rooms/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await parseJson<{ ok: boolean }>(res);
}
