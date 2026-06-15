"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

const SETTINGS_KEYS = {
  notification: "notification_settings",
} as const;

interface NotificationSettings {
  daysBefore: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

const defaults: NotificationSettings = {
  daysBefore: 3,
  emailEnabled: true,
  smsEnabled: false,
};

export default function AdminSettingsNotificationsPage() {
  const [daysBefore, setDaysBefore] = useState(defaults.daysBefore);
  const [emailEnabled, setEmailEnabled] = useState(defaults.emailEnabled);
  const [smsEnabled, setSmsEnabled] = useState(defaults.smsEnabled);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (data[SETTINGS_KEYS.notification]) {
          const n = data[SETTINGS_KEYS.notification] as Partial<NotificationSettings>;
          if (typeof n.daysBefore === "number") setDaysBefore(n.daysBefore);
          if (typeof n.emailEnabled === "boolean") setEmailEnabled(n.emailEnabled);
          if (typeof n.smsEnabled === "boolean") setSmsEnabled(n.smsEnabled);
        }
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [SETTINGS_KEYS.notification]: {
            daysBefore,
            emailEnabled,
            smsEnabled,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("알림 설정이 저장되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/settings"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          aria-label="설정 목록으로"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell size={26} className="text-primary-600" />
            알림 설정
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            기일 알림 기준일, 이메일/SMS 알림 연동을 설정합니다.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            기일 알림 기준 (D-Day)
          </label>
          <p className="text-xs text-text-muted mb-2">
            며칠 전부터 기일 알림을 보낼지 설정합니다.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={30}
              value={daysBefore}
              onChange={(e) => setDaysBefore(Number(e.target.value))}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
            <span className="text-sm text-slate-600">일 전부터 알림</span>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">알림 수단</label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="rounded border-slate-300 text-primary-600"
            />
            <span className="text-sm">이메일 알림 사용</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={smsEnabled}
              onChange={(e) => setSmsEnabled(e.target.checked)}
              className="rounded border-slate-300 text-primary-600"
            />
            <span className="text-sm">SMS 알림 사용 (연동 시)</span>
          </label>
        </div>
        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving} leftIcon={<Save size={16} />}>
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}
