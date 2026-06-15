"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Inbox, Send, Plus, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import type { MailMessage } from "@/lib/mailService";

type Tab = "inbound" | "outbound";

export default function MailPage() {
  const [tab, setTab] = useState<Tab>("inbound");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState({ fromAddress: "", toAddress: "", subject: "", bodyText: "" });
  const [saving, setSaving] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mail?direction=${tab}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "메일을 불러올 수 없습니다.");
        setMessages([]);
        return;
      }
      setMessages(data.messages ?? []);
    } catch {
      setError("연결에 실패했습니다.");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadMessages();
    setSelected(null);
  }, [loadMessages]);

  const openMessage = async (msg: MailMessage) => {
    setSelected(msg);
    if (!msg.isRead) {
      await fetch(`/api/mail/${msg.id}`, { credentials: "include" });
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
    }
  };

  const handleSend = async () => {
    if (!form.fromAddress.trim() || !form.toAddress.trim() || !form.subject.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ direction: "outbound", ...form }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      setComposeOpen(false);
      setForm({ fromAddress: "", toAddress: "", subject: "", bodyText: "" });
      if (tab === "outbound") loadMessages();
    } catch {
      setError("연결에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Mail size={24} className="text-primary-600" />
            메일 (LawTopMail 대체)
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Supabase mail_messages 테이블 기반 — SMTP/IMAP 실연동은 후속 Phase
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<RefreshCw size={14} />} onClick={loadMessages}>
            새로고침
          </Button>
          <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setComposeOpen(true)}>
            메일 작성
          </Button>
        </div>
      </div>

      <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50 w-fit">
        {(["inbound", "outbound"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium flex items-center gap-1.5",
              tab === t ? "bg-white text-primary-700 shadow-sm" : "text-text-muted hover:text-slate-700"
            )}
          >
            {t === "inbound" ? <Inbox size={14} /> : <Send size={14} />}
            {t === "inbound" ? "받은편지함" : "보낸편지함"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[420px]">
        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white shadow-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-muted gap-2">
              <Loader2 size={18} className="animate-spin" /> 불러오는 중…
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-16">메일이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-slate-50 max-h-[480px] overflow-y-auto">
              {messages.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => openMessage(m)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors",
                      selected?.id === m.id && "bg-primary-50/60",
                      !m.isRead && "font-semibold"
                    )}
                  >
                    <p className="text-sm text-slate-900 truncate">{m.subject || "(제목 없음)"}</p>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {tab === "inbound" ? m.fromAddress : m.toAddress}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {formatDate(m.receivedAt ?? m.sentAt ?? m.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-slate-100 bg-white shadow-card p-5">
          {selected ? (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">{selected.subject}</h2>
              <div className="text-xs text-text-muted space-y-1">
                <p>보낸 사람: {selected.fromAddress}</p>
                <p>받는 사람: {selected.toAddress}</p>
                <p>{formatDate(selected.receivedAt ?? selected.sentAt ?? selected.createdAt)}</p>
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap border-t border-slate-100 pt-4">
                {selected.bodyText || "(본문 없음)"}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-24">목록에서 메일을 선택하세요.</p>
          )}
        </div>
      </div>

      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900">메일 작성 (초안)</h3>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="보낸 사람"
              value={form.fromAddress}
              onChange={(e) => setForm((f) => ({ ...f, fromAddress: e.target.value }))}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="받는 사람"
              value={form.toAddress}
              onChange={(e) => setForm((f) => ({ ...f, toAddress: e.target.value }))}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="제목"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[120px]"
              placeholder="본문"
              value={form.bodyText}
              onChange={(e) => setForm((f) => ({ ...f, bodyText: e.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setComposeOpen(false)}>
                취소
              </Button>
              <Button size="sm" onClick={handleSend} disabled={saving}>
                {saving ? "저장 중…" : "저장"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
