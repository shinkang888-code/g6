"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type SetupStatus = {
  configured: boolean;
  canEdit: boolean;
  credentialsFromEnv: boolean;
  redirectUri: string;
  clientIdHint: string;
  bootstrapAllowed: boolean;
};

type GoogleOAuthSetupFormProps = {
  className?: string;
  compact?: boolean;
  onSaved?: () => void;
};

export function GoogleOAuthSetupForm({ className, compact, onSaved }: GoogleOAuthSetupFormProps) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google/setup");
      const data = (await res.json().catch(() => ({}))) as SetupStatus;
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCopyRedirect = async () => {
    if (!status?.redirectUri) return;
    try {
      await navigator.clipboard.writeText(status.redirectUri);
      toast.success("리디렉션 URI를 복사했습니다.");
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  const handleSave = async () => {
    if (!clientId.trim()) {
      toast.error("Client ID를 입력하세요.");
      return;
    }
    if (!status?.configured && !clientSecret.trim()) {
      toast.error("Client Secret을 입력하세요.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/google/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "저장에 실패했습니다.");
        return;
      }
      toast.success(data.message ?? "저장되었습니다.");
      setClientSecret("");
      await refresh();
      onSaved?.();
    } catch {
      toast.error("저장 요청 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500", className)}>
        Google OAuth 설정 확인 중…
      </div>
    );
  }

  if (!status?.canEdit) {
    return (
      <div className={cn("rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900", className)}>
        <p className="font-medium">Google OAuth는 환경 변수로 고정되어 있습니다.</p>
        <p className="mt-1 opacity-90">Vercel 대시보드 → Settings → Environment Variables에서 수정하세요.</p>
      </div>
    );
  }

  if (status.configured && compact) {
    return null;
  }

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Settings2 size={16} className="text-primary-600" />
          Google OAuth 직접 설정
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {status.bootstrapAllowed
            ? "Google Cloud Console에서 발급한 Client ID·Secret을 입력하면 즉시 적용됩니다."
            : "관리자로 로그인한 경우에만 값을 변경할 수 있습니다."}
        </p>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            승인된 리디렉션 URI
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={status.redirectUri}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono text-slate-700"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleCopyRedirect} aria-label="복사">
              <Copy size={14} />
            </Button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Google Cloud Console → 사용자 인증 정보 → OAuth 클라이언트에 위 URI를 등록하세요.
          </p>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline mt-1"
          >
            Google Cloud Console 열기
            <ExternalLink size={11} />
          </a>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Client ID <span className="text-slate-400">(GOOGLE_OAUTH_CLIENT_ID)</span>
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={status.clientIdHint || "123456789-abc.apps.googleusercontent.com"}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Client Secret <span className="text-slate-400">(GOOGLE_OAUTH_CLIENT_SECRET)</span>
          </label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={status.configured ? "변경 시에만 입력" : "GOCSPX-…"}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
            autoComplete="new-password"
          />
        </div>

        <Button
          type="button"
          className="w-full"
          leftIcon={<Save size={16} />}
          onClick={handleSave}
          loading={saving}
          disabled={saving}
        >
          저장하고 Google 로그인 활성화
        </Button>
      </div>
    </div>
  );
}
