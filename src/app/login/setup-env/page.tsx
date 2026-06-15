"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Settings2, Copy, ArrowLeft, Save, KeyRound, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ENV_SETUP_SECTIONS } from "@/lib/envSetupKeys";

type StoredMeta = Record<string, { set: boolean; masked?: string }>;

type VercelSyncStatus = {
  ready?: boolean;
  hasToken?: boolean;
  project?: { projectId: string; projectName?: string };
  hint?: string | null;
};

export default function SetupEnvPage() {
  const searchParams = useSearchParams();
  const isPopup = searchParams.get("popup") === "1";
  const [values, setValues] = useState<Record<string, string>>({});
  const [storedMeta, setStoredMeta] = useState<StoredMeta>({});
  const [vercelStatus, setVercelStatus] = useState<VercelSyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [vercelLoading, setVercelLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const refreshMeta = async () => {
    const [envRes, vercelRes] = await Promise.all([
      fetch("/api/setup-env").then((r) => r.json()),
      fetch("/api/setup-env/vercel").then((r) => r.json()),
    ]);
    if (envRes.values) setStoredMeta(envRes.values);
    if (envRes.error) toast.error(envRes.error);
    if (!vercelRes.error) setVercelStatus(vercelRes);
  };

  useEffect(() => {
    refreshMeta()
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  const setValue = (key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  const handleSave = async () => {
    const payload: Record<string, string> = {};
    for (const section of ENV_SETUP_SECTIONS) {
      for (const item of section.items) {
        const v = values[item.key]?.trim();
        if (v) payload[item.key] = v;
      }
    }
    if (Object.keys(payload).length === 0) {
      toast.error("저장할 값을 하나 이상 입력하세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/setup-env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "저장에 실패했습니다.");
        return;
      }
      toast.success(`.env.local에 ${data.saved?.length ?? 0}개 키가 저장되었습니다. 개발 서버를 재시작하세요.`);
      setValues({});
      await refreshMeta();
    } catch {
      toast.error("저장 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const collectPayload = () => {
    const payload: Record<string, string> = {};
    for (const section of ENV_SETUP_SECTIONS) {
      for (const item of section.items) {
        const v = values[item.key]?.trim();
        if (v) payload[item.key] = v;
      }
    }
    return payload;
  };

  const handleSyncVercel = async () => {
    const payload = collectPayload();
    const hasInput = Object.keys(payload).length > 0;
    const hasStored = ENV_SETUP_SECTIONS.some((section) =>
      section.items.some((item) => {
        if (item.key === "VERCEL_ACCESS_TOKEN") return false;
        return storedMeta[item.key]?.set;
      })
    );

    if (!hasInput && !hasStored) {
      toast.error("Vercel에 반영할 값을 입력하거나 .env.local에 먼저 저장하세요.");
      return;
    }

    setVercelLoading(true);
    try {
      const res = await fetch("/api/setup-env/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Vercel 반영에 실패했습니다.");
        return;
      }
      toast.success(data.message ?? `Vercel에 ${data.synced?.length ?? 0}개 키를 반영했습니다.`);
      await refreshMeta();
    } catch {
      toast.error("Vercel 반영 요청 중 오류가 발생했습니다.");
    } finally {
      setVercelLoading(false);
    }
  };

  const handleCopy = async () => {
    const lines: string[] = [];
    for (const section of ENV_SETUP_SECTIONS) {
      for (const item of section.items) {
        const v = values[item.key]?.trim();
        if (v) lines.push(`${item.key}=${v}`);
      }
    }
    if (lines.length === 0) {
      toast.error("복사할 입력값이 없습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n") + "\n");
      toast.success("클립보드에 복사되었습니다.");
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  return (
    <div className={cn("w-full", isPopup ? "max-w-lg" : "max-w-md")}>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
          <KeyRound size={22} className="text-primary-600" />
          환경 변수 설정
        </h1>
        <p className="text-sm text-slate-600 mt-1">로컬 `.env.local` 저장 · 연결된 Vercel 프로젝트 반영</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 sm:p-6 max-h-[70vh] overflow-y-auto">
        {vercelStatus?.project?.projectName ? (
          <div
            className={cn(
              "mb-4 rounded-xl border px-3 py-2.5 text-xs",
              vercelStatus.ready
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            )}
          >
            <p className="font-medium">
              Vercel 프로젝트: {vercelStatus.project.projectName}
              {vercelStatus.hasToken ? " · 토큰 설정됨" : " · 토큰 필요"}
            </p>
            {vercelStatus.hint ? <p className="mt-1 opacity-90">{vercelStatus.hint}</p> : null}
          </div>
        ) : null}
        {initialLoading ? (
          <p className="text-sm text-slate-500 text-center py-8">기존 설정 확인 중…</p>
        ) : (
          <div className="space-y-6">
            {ENV_SETUP_SECTIONS.map((section) => (
              <section key={section.title}>
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
                  <Settings2 size={16} className="text-primary-600" />
                  {section.title}
                </h2>
                <div className="space-y-3">
                  {section.items.map((item) => {
                    const meta = storedMeta[item.key];
                    return (
                      <div key={item.key}>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          {item.label}
                          <span className="text-slate-400 font-normal ml-1">({item.key})</span>
                        </label>
                        <input
                          type={item.secret ? "password" : "text"}
                          value={values[item.key] ?? ""}
                          onChange={(e) => setValue(item.key, e.target.value)}
                          placeholder={item.placeholder}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono",
                            "focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                          )}
                          autoComplete="off"
                        />
                        {meta?.set && !values[item.key] ? (
                          <p className="text-[11px] text-emerald-600 mt-1">
                            저장됨 {item.secret && meta.masked ? `(${meta.masked})` : ""}
                          </p>
                        ) : null}
                        {item.hint ? (
                          <p className="text-[11px] text-slate-500 mt-1">{item.hint}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 sticky bottom-0 bg-white">
          <Button
            type="button"
            className="w-full"
            leftIcon={<Save size={16} />}
            onClick={handleSave}
            disabled={loading || initialLoading}
            loading={loading}
          >
            .env.local에 저장
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            leftIcon={<CloudUpload size={16} />}
            onClick={handleSyncVercel}
            disabled={initialLoading || vercelLoading || loading}
            loading={vercelLoading}
          >
            Vercel에 반영
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            leftIcon={<Copy size={16} />}
            onClick={handleCopy}
            disabled={initialLoading}
          >
            입력값 클립보드 복사
          </Button>
          {!isPopup ? (
            <Link href="/login" className="block">
              <Button type="button" variant="ghost" size="sm" className="w-full" leftIcon={<ArrowLeft size={14} />}>
                로그인으로
              </Button>
            </Link>
          ) : (
            <p className="text-center text-xs text-slate-500">저장 후 개발 서버(`npm run dev`)를 재시작하세요.</p>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-slate-500 mt-4">
        「Vercel에 반영」은 production·preview·development에 동일 키를 등록합니다. 반영 후 재배포가 필요합니다.
      </p>
    </div>
  );
}
