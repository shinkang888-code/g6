"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchResultExcelButton } from "@/components/ui/SearchResultExcelButton";
import { exportNotificationsSearchResult } from "@/lib/listExcelExports";
import { toast } from "@/components/ui/toast";
import type { Notification } from "@/lib/types";

/** 알림을 날짜별로 그룹화 (날짜 키: YYYY.MM.DD) */
function groupByDate(list: Notification[]): { dateKey: string; dateLabel: string; items: Notification[] }[] {
  const map = new Map<string, Notification[]>();
  for (const n of list) {
    const key = formatDate(n.createdAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
  return sortedKeys.map((dateKey) => ({
    dateKey,
    dateLabel: dateKey,
    items: map.get(dateKey)!,
  }));
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadNotifications = () => {
    fetch("/api/notifications", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { data?: Notification[] }) => {
        setNotifications(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => setNotifications([]));
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const byDate = useMemo(() => groupByDate(notifications), [notifications]);

  const markAllRead = () => {
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ all: true }),
    }).then(() => loadNotifications());
  };

  const markRead = (id: string) => {
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids: [id] }),
    }).then(() => loadNotifications());
  };

  const openRelated = (n: Notification) => {
    const url = n.link ?? (n.caseId ? `/cases/${n.caseId}` : "/");
    if (n.approvalDocId) {
      router.push(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    markRead(n.id);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">알림</h1>
          <p className="text-sm text-text-muted mt-0.5">
            미읽음 {unreadCount}건 · 전체 {notifications.length}건
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchResultExcelButton
            count={notifications.length}
            onExport={() => {
              if (exportNotificationsSearchResult(notifications)) {
                toast.success(`${notifications.length}건을 엑셀로보냈습니다.`);
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Check size={13} />}
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            모두 읽음 처리
          </Button>
        </div>
      </div>

      {/* 날짜별 섹션: 상단에 날짜, 아래 좌우로 긴 알림 카드 목록 */}
      <div className="space-y-6">
        {byDate.map(({ dateKey, dateLabel, items }) => (
          <section key={dateKey}>
            <h2 className="text-sm font-semibold text-slate-600 mb-3 px-1">{dateLabel}</h2>
            <div className="overflow-x-auto pb-2 -mx-1 scrollbar-thin">
              <div className="flex gap-3 min-w-max">
                {items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openRelated(n)}
                    className={cn(
                      "flex gap-3 p-4 rounded-xl border text-left transition-all w-72 shrink-0",
                      "hover:border-primary-300 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                      !n.isRead ? "border-primary-200 bg-primary-50/50" : "border-slate-200 bg-white"
                    )}
                  >
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                        n.type === "urgent_date"
                          ? "bg-danger-100 text-danger-600"
                          : n.type === "approval_request"
                            ? "bg-primary-100 text-primary-600"
                            : "bg-warning-100 text-warning-600"
                      )}
                    >
                      <Bell size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 line-clamp-1">{n.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</div>
                      <div className="text-xs text-text-muted mt-1">
                        {formatDate(n.createdAt, "time")}
                      </div>
                    </div>
                    {!n.isRead && (
                      <div className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-12 text-text-muted text-sm">
          알림이 없습니다.
        </div>
      )}
    </div>
  );
}
