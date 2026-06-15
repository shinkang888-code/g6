import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, format?: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  if (format === "short") return `${month}.${day}`;
  if (format === "time") {
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  }
  return `${year}.${month}.${day}`;
}

export function getDDay(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function getDDayLabel(dateStr: string): string {
  const dday = getDDay(dateStr);
  if (dday < 0) return `D+${Math.abs(dday)}`;
  if (dday === 0) return "D-Day";
  return `D-${dday}`;
}

export function getDDayColor(dday: number): string {
  if (dday <= 0) return "text-danger-600 font-bold";
  if (dday <= 3) return "text-warning-500 font-semibold";
  if (dday <= 7) return "text-primary-600 font-medium";
  return "text-text-muted";
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export function parseStaffList(staffStr: string): string[] {
  if (!staffStr) return [];
  return staffStr.split(",").map((s) => s.trim()).filter(Boolean);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
