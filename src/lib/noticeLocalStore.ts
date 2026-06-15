/**
 * Supabase 미연결 로컬 개발용 공지 파일 저장소
 * (Next.js dev 멀티 워커 간 인메모리 상태 불일치 방지)
 */

import { promises as fs } from "fs";
import path from "path";
export type StoredNotice = {
  id: string;
  numId: number;
  title: string;
  content: string;
  authorName: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

const STORE_PATH = path.join(process.cwd(), ".data", "notices.json");

export async function readLocalNotices(): Promise<StoredNotice[] | null> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredNotice[]) : null;
  } catch {
    return null;
  }
}

export async function writeLocalNotices(items: StoredNotice[]): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(items, null, 2), "utf8");
}
