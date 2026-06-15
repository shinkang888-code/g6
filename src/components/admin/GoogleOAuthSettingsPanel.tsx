"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, RefreshCw, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { EnvCredentialsUnlockBar } from "@/components/admin/PlatformSecretsGate";

type GoogleOAuthResponse = {
  enabled: boolean;
  configured: boolean;
  credentialsFromEnv: boolean;
  canOverrideEnv?: boolean;
  preferDbOverEnv?: boolean;
  source: string;
  clientId: string;
  clientSecretMasked: string;
  hasStoredSecret: boolean;
  redirectUri: string;
  hint: string | null;
};

type Props = {
  showBackLink?: boolean;
};

export function GoogleOAuthSettingsPanel({ showBackLink = true }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<GoogleOAuthResponse | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [envEditUnlocked, setEnvEditUnlocked] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings/google-oauth", { credentials: "include" });
    const data = (await res.json()) as GoogleOAuthResponse & { error?: string };
    if (!res.ok) throw new Error(data.error || "설정을 불러오지 못했습니다.");
    setStatus(data);
    setClientId(data.clientId ?? "");
    setClientSecret("");
    setEnabled(data.enabled !== false);
    setEnvEditUnlocked(false);
    return data;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "설정 로드 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/google-oauth", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          clientSecret: clientSecret.trim() || undefined,
          enabled,
          overrideEnv: envEditUnlocked && status?.canOverrideEnv ? true : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      toast.success("Google OAuth 설정이 저장되었습니다.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">설정을 불러오는 중…</p>;
  }

  const fromEnv = status?.credentialsFromEnv;
  const configured = status?.configured;
  const canEdit = !fromEnv || envEditUnlocked;

  return (
    <div className="space-y-6">
      {showBackLink && (
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-primary-600"
        >
          <ArrowLeft size={16} />
          시스템 설정으로
        </Link>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Google OAuth (로그인·가입)</h1>
        <p className="text-sm text-slate-600 mt-1">
          Google 계정으로 빠르게 회원가입·로그인할 수 있도록 OAuth 클라이언트를 등록합니다.
        </p>
      </div>

      <div
        className={cn(
          "rounded-xl border p-4 flex items-start gap-3",
          configured ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
        )}
      >
        {configured ? (
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="text-sm">
          <p className={cn("font-medium", configured ? "text-emerald-800" : "text-amber-800")}>
            {configured ? "Google 로그인 사용 가능" : "Google 로그인 미설정"}
          </p>
          <p className={cn("mt-1", configured ? "text-emerald-700" : "text-amber-700")}>
            {status?.hint}
          </p>
          {status?.source && configured ? (
            <p className="text-xs mt-1 opacity-80">설정 출처: {status.source === "env" ? "환경 변수" : "DB"}</p>
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-5">
        <EnvCredentialsUnlockBar
          visible={Boolean(status?.canOverrideEnv)}
          unlocked={envEditUnlocked}
          onUnlock={() => setEnvEditUnlocked(true)}
          onCancel={() => {
            setEnvEditUnlocked(false);
            setClientSecret("");
            void load();
          }}
          envLabel="GOOGLE_OAUTH_CLIENT_ID / SECRET"
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">승인된 리디렉션 URI</label>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs bg-slate-100 px-2 py-1.5 rounded-lg break-all">{status?.redirectUri}</code>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
            >
              Google Cloud Console
              <ExternalLink size={12} />
            </a>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            OAuth 클라이언트의「승인된 리디렉션 URI」에 위 주소를 반드시 추가하세요.
          </p>
        </div>

        {fromEnv && !envEditUnlocked ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
            환경 변수로 OAuth가 설정되어 있습니다. Client ID: <strong>{status?.clientId}</strong>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxx.apps.googleusercontent.com"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Secret</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={status?.hasStoredSecret ? `저장됨 (${status.clientSecretMasked})` : "GOCSPX-..."}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">비워 두면 기존 Secret을 유지합니다.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-slate-300"
              />
              Google 로그인·가입 활성화
            </label>
          </>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {canEdit && (
            <Button leftIcon={<Save size={16} />} onClick={handleSave} disabled={saving} loading={saving}>
              저장
            </Button>
          )}
          <Button
            variant="outline"
            leftIcon={<RefreshCw size={16} />}
            onClick={() => load().catch((e) => toast.error(e.message))}
          >
            새로고침
          </Button>
        </div>
      </div>
    </div>
  );
}
