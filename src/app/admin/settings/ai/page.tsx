"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Save, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

const SETTINGS_KEY = "ai_settings";

interface AiSettings {
  geminiApiKey: string;
  openaiApiKey: string;
}

const defaults: AiSettings = {
  geminiApiKey: "",
  openaiApiKey: "",
};

export default function AdminSettingsAiPage() {
  const [form, setForm] = useState<AiSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (res.ok) {
          setDbConnected(true);
          if (data[SETTINGS_KEY]) {
            const s = data[SETTINGS_KEY] as Partial<AiSettings>;
            setForm((prev) => ({ ...prev, ...s }));
          }
        } else {
          setDbConnected(false);
        }
      } catch {
        setDbConnected(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleTestGemini = async () => {
    if (!form.geminiApiKey.trim()) {
      toast.error("Gemini API 키를 입력한 뒤 연결 테스트를 실행하세요.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/admin/settings/ai/test-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiApiKey: form.geminiApiKey }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Gemini 연결 테스트 실패");
      }
      toast.success(`Gemini API 연결 성공 (${json.model ?? "ok"})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gemini 연결 테스트 실패");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (dbConnected === false) {
      toast.error("DB가 연결되지 않았습니다. 아래 안내에 따라 환경 변수를 설정한 뒤 다시 시도하세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [SETTINGS_KEY]: form }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "저장에 실패했습니다.");
      toast.success("AI 연동 설정이 저장되었습니다. 전문 게시판 AI 기능을 바로 사용할 수 있습니다.");
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
        <Link href="/settings" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="설정 목록으로">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles size={26} className="text-primary-500" />
            AI 연동관리
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Gemini·ChatGPT API 키를 입력하면 전문 게시판 AI 문서엔진(판례검색, 법률검색, 문서요약·서면작성)에서 선택해 사용할 수 있습니다.
          </p>
        </div>
      </div>

      {/* DB 연동 상태 */}
      {dbConnected !== null && (
        <div
          className={dbConnected
            ? "flex items-center gap-2 text-sm text-success-700 bg-success-50 border border-success-200 rounded-xl px-4 py-3"
            : "flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
          }
        >
          {dbConnected ? (
            <CheckCircle2 size={20} className="shrink-0" />
          ) : (
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            {dbConnected ? (
              <span>DB에 연결되었습니다. API 키를 저장하면 전문 게시판 AI 기능에 바로 적용됩니다.</span>
            ) : (
              <div>
                <p className="font-medium">DB가 연결되지 않았습니다.</p>
                <p className="mt-1 text-amber-700">
                  <code className="bg-white/60 px-1 rounded">.env.local</code>에{" "}
                  <code className="bg-white/60 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
                  <code className="bg-white/60 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code>를 설정하고, Supabase에{" "}
                  <code className="bg-white/60 px-1 rounded">app_settings</code> 테이블을 생성한 뒤 앱을 재시작하세요. 자세한 내용은 README의 DB 연동 섹션을 참고하세요.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-6">
        <p className="text-sm text-slate-600 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
          <strong>연동 오류가 나는 경우</strong> 아래 API 키를 입력한 뒤 <strong>저장</strong> 버튼을 누르면 됩니다. 게시판 AI 문서엔진에서 Gemini 또는 ChatGPT 중 선택해 사용할 수 있습니다.
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Google Gemini API Key</label>
          <input
            type="password"
            value={form.geminiApiKey}
            onChange={(e) => setForm((p) => ({ ...p, geminiApiKey: e.target.value }))}
            placeholder="AIzaSy... (여기에 키 입력 후 저장)"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            autoComplete="off"
          />
          <p className="text-xs text-text-muted mt-1">
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              Google AI Studio
            </a>
            에서 발급. 저장 시 키 유효성을 검사합니다. OCR·요약 모두 이 키를 사용합니다.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={testing || !form.geminiApiKey.trim()}
            leftIcon={testing ? undefined : <Zap size={14} />}
            onClick={handleTestGemini}
          >
            {testing ? "연결 테스트 중…" : "Gemini 연결 테스트"}
          </Button>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">OpenAI (ChatGPT) API Key</label>
          <input
            type="password"
            value={form.openaiApiKey}
            onChange={(e) => setForm((p) => ({ ...p, openaiApiKey: e.target.value }))}
            placeholder="sk-... (여기에 키 입력 후 저장)"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
            autoComplete="off"
          />
          <p className="text-xs text-text-muted mt-1">
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              OpenAI API Keys
            </a>
            에서 발급. 저장 후 게시판 → AI·문서 엔진에서 「ChatGPT」로 선택해 사용 가능.
          </p>
        </div>
        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={saving || dbConnected === false}
            leftIcon={<Save size={16} />}
          >
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}
