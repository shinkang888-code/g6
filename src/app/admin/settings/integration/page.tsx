"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Database, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PlatformSecretsGate } from "@/components/admin/PlatformSecretsGate";

const SETTINGS_KEYS = {
  integration: "integration_settings",
} as const;

interface IntegrationSettings {
  supabaseUrl: string;
  supabaseAnonKey: string;
  gnuboardApiUrl: string;
  gnuboardApiKey: string;
}

const defaults: IntegrationSettings = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  gnuboardApiUrl: "",
  gnuboardApiKey: "",
};


export default function AdminSettingsIntegrationPage() {
  return (
    <PlatformSecretsGate title="DB·API 연동">
      <IntegrationSettingsContent />
    </PlatformSecretsGate>
  );
}

function IntegrationSettingsContent() {
  const [form, setForm] = useState<IntegrationSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (data[SETTINGS_KEYS.integration]) {
          const i = data[SETTINGS_KEYS.integration] as Partial<IntegrationSettings>;
          setForm((prev) => ({
            ...prev,
            ...i,
          }));
        } else {
          setForm((prev) => ({
            ...prev,
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
            gnuboardApiUrl: process.env.NEXT_PUBLIC_GNUBOARD_API_URL ?? "",
          }));
        }
      } catch {
        setForm((prev) => ({
          ...prev,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
          gnuboardApiUrl: process.env.NEXT_PUBLIC_GNUBOARD_API_URL ?? "",
        }));
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
          [SETTINGS_KEYS.integration]: form,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("연동 설정이 저장되었습니다.");
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
            <Database size={26} className="text-primary-600" />
            DB·API 연동
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Supabase, 그누보드 G6 URL·키를 설정합니다. DB에 저장되며, 런타임 연동은 .env와 병행해 사용할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Supabase URL</label>
          <input
            type="url"
            value={form.supabaseUrl}
            onChange={(e) => setForm((p) => ({ ...p, supabaseUrl: e.target.value }))}
            placeholder="https://xxxx.supabase.co"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Supabase Anon Key</label>
          <input
            type="password"
            value={form.supabaseAnonKey}
            onChange={(e) => setForm((p) => ({ ...p, supabaseAnonKey: e.target.value }))}
            placeholder=".env에 설정된 경우 마스킹 표시"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <p className="text-xs text-text-muted mt-1">비워두면 .env 값 유지. 새로 입력 시에만 덮어씁니다.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">그누보드 G6 API URL</label>
          <input
            type="url"
            value={form.gnuboardApiUrl}
            onChange={(e) => setForm((p) => ({ ...p, gnuboardApiUrl: e.target.value }))}
            placeholder="http://localhost:8000"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
          <div className="mt-2 rounded-lg bg-primary-50 border border-primary-100 p-3 text-xs text-slate-700 space-y-1.5">
            <p className="font-medium text-primary-800">그누보드 연동하려면</p>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
              <li>루트에서 <code className="bg-white/80 px-1 rounded">npm run setup:g6</code> (포크 리포 submodule + Python 의존성)</li>
              <li>G6 실행: <code className="bg-white/80 px-1 rounded">npm run dev:g6</code> → <code className="bg-white/80 px-1 rounded">http://localhost:8000</code></li>
              <li>LawyGo 실행: <code className="bg-white/80 px-1 rounded">npm run dev</code> → <code className="bg-white/80 px-1 rounded">http://localhost:3000</code></li>
              <li><code className="bg-white/80 px-1 rounded">.env.local</code>에 <code className="bg-white/80 px-1 rounded">NEXT_PUBLIC_GNUBOARD_API_URL=http://localhost:8000</code> 및 G6 관리자 계정(<code className="bg-white/80 px-1 rounded">GNUBOARD_API_USERNAME</code>/<code className="bg-white/80 px-1 rounded">GNUBOARD_API_PASSWORD</code>) 설정</li>
            </ol>
            <p className="text-slate-500 pt-0.5">자세한 내용: <code className="bg-white/80 px-1 rounded">docs/g6-install.md</code> · 포크: shinkang888-code/g6</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">그누보드 G6 API Key</label>
          <input
            type="password"
            value={form.gnuboardApiKey}
            onChange={(e) => setForm((p) => ({ ...p, gnuboardApiKey: e.target.value }))}
            placeholder="선택"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          />
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
          실제 클라이언트 연동은 <code className="bg-white px-1 rounded">.env.local</code>의
          NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_GNUBOARD_API_URL 등과 함께 사용됩니다. 여기 저장값은 관리용·백엔드 참고용으로 활용할 수 있습니다.
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
