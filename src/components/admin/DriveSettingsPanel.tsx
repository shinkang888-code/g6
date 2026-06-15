"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cloud,
  Save,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Upload,
  Trash2,
  FileJson,
  Link2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  encodeServiceAccountJsonForStorage,
  validateServiceAccountJsonText,
} from "@/lib/driveServiceAccount";
import { EnvCredentialsUnlockBar } from "@/components/admin/PlatformSecretsGate";

type DriveSettingsResponse = {
  enabled: boolean;
  rootFolderId: string;
  hasStoredCredentials: boolean;
  credentialsFromEnv: boolean;
  canOverrideEnv?: boolean;
  preferDbOverEnv?: boolean;
  serviceAccountEmail: string | null;
  oauthConnected?: boolean;
  oauthDelegateEmail?: string | null;
  configured: boolean;
  available: boolean;
  hint: string | null;
};

type Props = {
  showBackLink?: boolean;
  compact?: boolean;
};

export function DriveSettingsPanel({ showBackLink = true, compact = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<DriveSettingsResponse | null>(null);
  const [pendingCredentialsBase64, setPendingCredentialsBase64] = useState("");
  const [pendingFileName, setPendingFileName] = useState("");
  const [pendingClientEmail, setPendingClientEmail] = useState("");
  const [rootFolderId, setRootFolderId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [removeCredentials, setRemoveCredentials] = useState(false);
  const [envEditUnlocked, setEnvEditUnlocked] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings/drive", { credentials: "include" });
    const data = (await res.json()) as DriveSettingsResponse & { error?: string };
    if (!res.ok) throw new Error(data.error || "설정을 불러오지 못했습니다.");
    setStatus(data);
    setRootFolderId(data.rootFolderId ?? "");
    setEnabled(data.enabled !== false);
    setRemoveCredentials(false);
    setPendingCredentialsBase64("");
    setPendingFileName("");
    setPendingClientEmail("");
    setEnvEditUnlocked(false);
    return data;
  }, []);

  const refreshStatus = async () => {
    setChecking(true);
    try {
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "상태 확인 실패");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("drive_oauth");
    if (oauth === "success") {
      const email = params.get("email");
      toast.success(
        email ? `Drive 업로드 권한 연결 완료 (${email})` : "Drive 업로드 권한 연결 완료"
      );
      window.history.replaceState({}, "", window.location.pathname);
    } else if (oauth === "denied") {
      toast.error("Google Drive 권한 연결이 취소되었습니다.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (oauth && oauth !== "success") {
      toast.error(`Drive OAuth 실패: ${oauth}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "설정을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const applyJsonText = (text: string, fileName?: string) => {
    try {
      const parsed = validateServiceAccountJsonText(text);
      setPendingCredentialsBase64(encodeServiceAccountJsonForStorage(text));
      setPendingClientEmail(parsed.clientEmail);
      setPendingFileName(fileName ?? "service-account.json");
      setRemoveCredentials(false);
      toast.success("JSON 키가 확인되었습니다. 저장을 눌러 적용하세요.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "유효한 JSON 키 파일이 아닙니다.");
    }
  };

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      toast.error("JSON 파일만 업로드할 수 있습니다.");
      return;
    }
    const text = await file.text();
    applyJsonText(text, file.name);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        rootFolderId: rootFolderId.trim(),
        enabled,
        removeCredentials,
      };
      if (pendingCredentialsBase64) {
        payload.credentialsBase64 = pendingCredentialsBase64;
      }
      if (envEditUnlocked && status?.canOverrideEnv) {
        payload.overrideEnv = true;
      }

      const res = await fetch("/api/admin/settings/drive", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");

      toast.success("Google Drive 설정이 저장되었습니다.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const hasEffectiveCredentials =
    Boolean(pendingCredentialsBase64) ||
    (Boolean(status?.hasStoredCredentials) && !removeCredentials);

  const envLocked = Boolean(status?.credentialsFromEnv);
  const canEditCredentials = !envLocked || envEditUnlocked;
  const canSave = canEditCredentials && !saving;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted text-sm">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", compact && "space-y-4")}>
      {showBackLink && (
        <div className="flex items-center gap-2 text-sm">
          <Link href="/admin/settings" className="text-primary-600 hover:underline">
            시스템 설정
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600">Google Drive</span>
        </div>
      )}

      <div>
        <h1
          className={cn(
            "font-bold text-slate-900 flex items-center gap-2",
            compact ? "text-xl" : "text-2xl"
          )}
        >
          <Cloud size={compact ? 22 : 26} className="text-primary-600" />
          Google Drive 자료실
        </h1>
        <p className="text-sm text-text-muted mt-0.5">
          사건 자료실 파일을 Google Drive에 저장합니다. GCP 서비스 계정 JSON 키를 등록하세요.
        </p>
      </div>

      {status && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            {status.available ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : (
              <XCircle size={18} className="text-amber-600" />
            )}
            <span className="font-medium text-slate-800">
              {status.available
                ? "Drive 연동 정상"
                : status.configured
                  ? "키 등록됨 · Drive 접근 확인 필요"
                  : "미설정"}
            </span>
          </div>
          {(pendingClientEmail || status.serviceAccountEmail) && (
            <span className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded font-mono">
              {pendingClientEmail || status.serviceAccountEmail}
            </span>
          )}
          {status.credentialsFromEnv && !envEditUnlocked && (
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
              환경 변수 키 사용 중
            </span>
          )}
          {status.oauthConnected && status.oauthDelegateEmail && (
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-mono">
              OAuth 업로드: {status.oauthDelegateEmail}
            </span>
          )}
          {status.hint && <p className="text-xs text-amber-700 w-full">{status.hint}</p>}
          <Button
            size="sm"
            variant="outline"
            onClick={refreshStatus}
            disabled={checking}
            leftIcon={<RefreshCw size={14} className={checking ? "animate-spin" : ""} />}
          >
            연결 테스트
          </Button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-6">
        <EnvCredentialsUnlockBar
          visible={Boolean(status?.canOverrideEnv)}
          unlocked={envEditUnlocked}
          onUnlock={() => setEnvEditUnlocked(true)}
          onCancel={() => {
            setEnvEditUnlocked(false);
            setPendingCredentialsBase64("");
            setPendingFileName("");
            setPendingClientEmail("");
            setRemoveCredentials(false);
          }}
          envLabel="GOOGLE_DRIVE_CREDENTIALS_BASE64"
        />

        <div className="rounded-lg border border-primary-200 bg-primary-50/40 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-800 flex items-center gap-2">
            <Link2 size={16} className="text-primary-600" />
            업로드 권한 연결 (OAuth) — 필수
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Google 정책상 <strong>서비스 계정만으로는 파일 업로드가 불가</strong>합니다.
            <strong> shinkang888@gmail.com</strong> 계정으로 OAuth를 연결하면 해당 Drive 용량으로
            업로드됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<ExternalLink size={14} />}
              onClick={() => {
                window.location.href = "/api/admin/settings/drive/oauth/start";
              }}
            >
              {status?.oauthConnected ? "업로드 권한 다시 연결" : "업로드 권한 연결"}
            </Button>
            {status?.oauthConnected && (
              <span className="text-xs text-emerald-700 self-center">
                연결됨: {status.oauthDelegateEmail}
              </span>
            )}
          </div>
          <p className="text-xs text-amber-700">
            Google Cloud Console OAuth 클라이언트에 리디렉션 URI 추가:{" "}
            <code className="bg-white px-1 rounded break-all">
              {typeof window !== "undefined"
                ? `${window.location.origin}/api/admin/settings/drive/oauth/callback`
                : "/api/admin/settings/drive/oauth/callback"}
            </code>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            서비스 계정 JSON 키 (목록·메타 조회용)
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
              !canEditCredentials
                ? "border-slate-200 bg-slate-50 opacity-60 pointer-events-none"
                : dragOver
                  ? "border-primary-400 bg-primary-50/50"
                  : "border-slate-200 hover:border-primary-300 hover:bg-slate-50/50"
            )}
          >
            <FileJson size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-700 mb-1">
              JSON 파일을 드래그하거나 아래 버튼으로 선택하세요
            </p>
            <p className="text-xs text-text-muted mb-3">
              GCP → IAM → 서비스 계정 → 키 → JSON 다운로드
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileInput}
              disabled={!canEditCredentials}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={!canEditCredentials}
            >
              JSON 파일 선택
            </Button>
          </div>

          {(pendingFileName || (status?.hasStoredCredentials && !removeCredentials)) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {pendingFileName ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary-50 text-primary-800">
                  <FileJson size={12} />
                  업로드 대기: {pendingFileName}
                </span>
              ) : status?.hasStoredCredentials && !removeCredentials ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-800">
                  <CheckCircle2 size={12} />
                  저장된 키 사용 중
                </span>
              ) : null}
              {status?.hasStoredCredentials && canEditCredentials && !pendingFileName && (
                <button
                  type="button"
                  onClick={() => {
                    setRemoveCredentials(true);
                    setPendingCredentialsBase64("");
                    setPendingFileName("");
                    setPendingClientEmail("");
                    toast.info("저장 시 등록된 키가 삭제됩니다.");
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-danger-600 hover:bg-danger-50"
                >
                  <Trash2 size={12} />
                  키 삭제
                </button>
              )}
              {removeCredentials && (
                <span className="text-danger-600">저장하면 키가 삭제됩니다.</span>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            루트 폴더 ID (선택)
          </label>
          <input
            type="text"
            value={rootFolderId}
            onChange={(e) => setRootFolderId(e.target.value)}
            placeholder="공유 드라이브 또는 LawBoard 폴더 ID"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
          />
          <p className="text-xs text-text-muted mt-1">
            <strong className="text-amber-700">필수:</strong> 서비스 계정은 저장 공간이 없습니다.{" "}
            <strong>shinkang888@gmail.com</strong> Google Drive에 LawBoard 폴더를 만들고 서비스 계정 이메일을{" "}
            <strong>편집자</strong>로 공유한 뒤, 해당 폴더 ID를 아래에 입력하세요.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-300 text-primary-600"
          />
          Google Drive 연동 사용
        </label>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-2">
          <p className="font-medium text-slate-700">설정 안내</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>GCP에서 Drive API를 사용 설정하고 서비스 계정을 만듭니다.</li>
            <li>서비스 계정 JSON 키를 위에서 업로드한 뒤 저장합니다.</li>
            <li>Google Drive에서 자료실용 폴더를 서비스 계정 이메일과 공유합니다.</li>
            <li>「연결 테스트」로 자료실 업로드 가능 여부를 확인합니다.</li>
          </ol>
          <a
            href="https://console.cloud.google.com/iam-admin/serviceaccounts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary-600 hover:underline mt-1"
          >
            GCP 서비스 계정 콘솔
            <ExternalLink size={12} />
          </a>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSave}
            disabled={!canSave}
            leftIcon={<Save size={16} />}
          >
            {saving ? "저장 중…" : "저장"}
          </Button>
          {!hasEffectiveCredentials && canEditCredentials && (
            <span className="text-xs text-amber-700 self-center">
              JSON 키를 업로드한 뒤 저장하세요.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
