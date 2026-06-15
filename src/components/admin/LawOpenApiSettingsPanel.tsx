"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  CloudUpload,
  Scale,
  KeyRound,
  FileKey2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { EnvCredentialsUnlockBar } from "@/components/admin/PlatformSecretsGate";

type LawOpenApiStatus = {
  configured: boolean;
  credentialsFromEnv: boolean;
  canOverrideEnv?: boolean;
  preferDbOverEnv?: boolean;
  source: "env" | "db" | "local" | "none";
  localEnvSupported?: boolean;
  enabled: boolean;
  oc: string;
  hasStoredOc: boolean;
  envKey: string;
  hint: string | null;
  registerUrl: string;
};

type VercelSyncStatus = {
  ready: boolean;
  hasToken: boolean;
  project?: { projectId: string; projectName?: string } | null;
  hint: string | null;
  envKey: string;
};

type LocalEnvStatus = {
  supported: boolean;
  values?: Record<string, { set: boolean; masked?: string }>;
  vercelReady?: boolean;
  hint?: string | null;
};

type Props = {
  showBackLink?: boolean;
};

export function LawOpenApiSettingsPanel({ showBackLink = true }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<LawOpenApiStatus | null>(null);
  const [vercelStatus, setVercelStatus] = useState<VercelSyncStatus | null>(null);
  const [ocInput, setOcInput] = useState("");
  const [vercelTokenInput, setVercelTokenInput] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [localEnv, setLocalEnv] = useState<LocalEnvStatus | null>(null);
  const [savingLocal, setSavingLocal] = useState(false);
  const [envEditUnlocked, setEnvEditUnlocked] = useState(false);

  const loadLocalEnv = useCallback(async () => {
    const res = await fetch("/api/admin/settings/law-open-api/local-env", { credentials: "include" });
    const data = (await res.json()) as LocalEnvStatus;
    if (res.ok) setLocalEnv(data);
    else setLocalEnv({ supported: false });
    return data;
  }, []);

  const loadVercel = useCallback(async () => {
    const res = await fetch("/api/admin/settings/law-open-api/vercel", { credentials: "include" });
    const data = (await res.json()) as VercelSyncStatus & { error?: string };
    if (!res.ok) throw new Error(data.error || "Vercel 연동 상태를 불러오지 못했습니다.");
    setVercelStatus(data);
    return data;
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings/law-open-api", { credentials: "include" });
    const data = (await res.json()) as LawOpenApiStatus & { error?: string };
    if (!res.ok) throw new Error(data.error || "설정을 불러오지 못했습니다.");
    setStatus(data);
    setOcInput("");
    setEnabled(data.enabled !== false);
    await Promise.all([loadVercel().catch(() => setVercelStatus(null)), loadLocalEnv().catch(() => null)]);
    return data;
  }, [loadVercel, loadLocalEnv]);

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
    const oc = ocInput.trim();
    if (!oc && !status?.hasStoredOc) {
      toast.error("OC 값을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/law-open-api", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oc: oc || undefined,
          enabled,
          overrideEnv: envEditUnlocked && status?.canOverrideEnv ? true : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      toast.success("국가법령정보 API 설정이 저장되었습니다.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocalEnv = async () => {
    const token = vercelTokenInput.trim();
    const oc = ocInput.trim();
    if (!token && !oc) {
      toast.error("Vercel Access Token 또는 OC 값을 입력하세요.");
      return;
    }
    setSavingLocal(true);
    try {
      const res = await fetch("/api/admin/settings/law-open-api/local-env", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vercelAccessToken: token || undefined,
          lawGoKrOc: oc || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      toast.success(data.message ?? ".env.local에 저장했습니다.");
      setVercelTokenInput("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSavingLocal(false);
    }
  };

  const handleVercelSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/settings/law-open-api/vercel", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oc: ocInput.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Vercel 반영 실패");
      toast.success(data.message ?? "Vercel 환경 변수에 반영했습니다.");
      await loadVercel();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vercel 반영 실패");
    } finally {
      setSyncing(false);
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
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Scale size={26} className="text-primary-600" />
          국가법령정보 Open API
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          법률 검색 게시판에서 조문 원문을 Open API로 불러옵니다. OC 값은 Vercel 환경 변수{" "}
          <code className="text-xs bg-slate-100 px-1 rounded">{status?.envKey}</code>로 반영됩니다.
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
            {configured ? "법령 Open API 사용 가능" : "법령 Open API 미설정"}
          </p>
          <p className={cn("mt-1", configured ? "text-emerald-700" : "text-amber-700")}>{status?.hint}</p>
          {status?.source && configured ? (
            <p className="text-xs mt-1 opacity-80">
              설정 출처:{" "}
              {status.source === "env"
                ? "Vercel/환경 변수"
                : status.source === "local"
                  ? ".env.local"
                  : "DB"}
              {status.oc ? ` · OC: ${status.oc}` : ""}
            </p>
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
            setOcInput("");
            void load();
          }}
          envLabel={status?.envKey ?? "LAW_GO_KR_OC"}
        />

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 space-y-2">
          <p className="font-medium text-slate-800">API 신청 방법</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-600">
            <li>
              <a
                href={status?.registerUrl ?? "https://open.law.go.kr/LSO/main.do"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline inline-flex items-center gap-1"
              >
                국가법령정보 공동활용
                <ExternalLink size={12} />
              </a>
              에서 Open API 이용 신청
            </li>
            <li>발급된 OC 값(신청 이메일 @ 앞 ID)을 아래에 입력</li>
            <li>Vercel 프로젝트 IP/도메인(lawygo.vercel.app)을 API 신청서에 등록</li>
            <li>
              로컬 <code className="bg-white px-1 rounded">.env.local</code>에 Vercel 토큰 저장 → OC 저장 → 「Vercel에 반영」
            </li>
          </ol>
        </div>

        {localEnv?.supported ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileKey2 size={16} className="text-primary-600" />
              로컬 .env.local (권장)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Vercel 토큰은 <strong>로컬 .env.local</strong>에만 보관합니다. 저장 직후 「Vercel에 반영」이 가능하며, 서버 재시작 없이
              동기화 API가 파일에서 토큰을 읽습니다.
            </p>
            <div>
              <label htmlFor="vercelAccessToken" className="block text-sm font-medium text-slate-700 mb-1">
                Vercel Access Token
              </label>
              <input
                id="vercelAccessToken"
                type="password"
                value={vercelTokenInput}
                onChange={(e) => setVercelTokenInput(e.target.value)}
                placeholder={
                  localEnv.values?.VERCEL_ACCESS_TOKEN?.set
                    ? `저장됨 (${localEnv.values.VERCEL_ACCESS_TOKEN.masked})`
                    : "vercel_xxxxxxxx"
                }
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-mono"
                autoComplete="off"
              />
              <p className="text-xs text-slate-500 mt-1">
                <a
                  href="https://vercel.com/account/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline inline-flex items-center gap-1"
                >
                  Vercel → Settings → Tokens
                  <ExternalLink size={11} />
                </a>
                에서 발급 (Full Account 또는 프로젝트 scope)
              </p>
            </div>
            {localEnv.hint ? (
              <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
                {localEnv.hint}
              </p>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<KeyRound size={14} />}
              onClick={handleSaveLocalEnv}
              disabled={savingLocal}
              loading={savingLocal}
            >
              .env.local에 저장
            </Button>
          </div>
        ) : null}

        {fromEnv && !envEditUnlocked ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
            환경 변수 <code className="bg-white px-1 rounded">{status?.envKey}</code>로 설정되어 있습니다.
            {status?.oc ? (
              <>
                {" "}
                OC: <strong>{status.oc}</strong>
              </>
            ) : null}
            <p className="text-xs mt-2 text-slate-500">
              교체하려면 위 「환경 변수 키 교체」 버튼을 누르세요.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="lawGoKrOc" className="block text-sm font-medium text-slate-700 mb-1">
                OC (Open API 인증 ID)
              </label>
              <input
                id="lawGoKrOc"
                type="text"
                value={ocInput}
                onChange={(e) => setOcInput(e.target.value)}
                placeholder={status?.hasStoredOc ? `저장됨 (${status.oc})` : "예: myemailid (user@example.com → myemailid)"}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none font-mono"
                autoComplete="off"
              />
              <p className="text-xs text-slate-500 mt-1">비워 두고 저장하면 기존 OC를 유지합니다.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-slate-300"
              />
              법령 Open API 사용
            </label>
          </>
        )}

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <CloudUpload size={16} className="text-primary-600" />
            Vercel 환경 변수 반영
          </h3>
          {vercelStatus?.ready ? (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              연결됨: {vercelStatus.project?.projectName ?? vercelStatus.project?.projectId} · 키{" "}
              <code>{vercelStatus.envKey}</code>
            </p>
          ) : (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {vercelStatus?.hint ??
                "위 「.env.local에 저장」으로 VERCEL_ACCESS_TOKEN을 넣은 뒤, 프로젝트 루트에서 vercel link가 되어 있어야 합니다."}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {canEdit && (
            <Button leftIcon={<Save size={16} />} onClick={handleSave} disabled={saving} loading={saving}>
              저장
            </Button>
          )}
          <Button
            variant="outline"
            leftIcon={<CloudUpload size={16} />}
            onClick={handleVercelSync}
            disabled={syncing || (fromEnv && !envEditUnlocked)}
            loading={syncing}
          >
            Vercel에 반영
          </Button>
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
