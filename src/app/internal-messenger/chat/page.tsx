"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Send,
  Paperclip,
  FileText,
  Download,
  X,
  MessageCircle,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { InternalMessage } from "@/lib/types";
import {
  fetchInternalMessages,
  sendInternalMessage,
  markMessageRead,
} from "@/lib/internalMessengerApi";

const FALLBACK_USER = { id: "", name: "나", loginId: "" };

function useCurrentUser(): { id: string; name: string; loginId: string } {
  const [user, setUser] = useState(FALLBACK_USER);
  useEffect(() => {
    function apply(u: { id?: string; userId?: string; name?: string; loginId?: string } | null) {
      if (!u) return;
      const id = String(u.id ?? u.userId ?? "");
      const name = u.name || u.loginId || "나";
      const loginId = u.loginId ?? "";
      setUser({ id, name, loginId });
    }
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) apply(d.user);
        else return fetch("/api/auth/session", { credentials: "include" }).then((r) => r.json());
      })
      .then((s) => {
        if (s?.user) apply(s.user);
      })
      .catch(() => {});
  }, []);
  return user;
}

function formatChatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

const POLL_MS = 2500;

export default function InternalMessengerChatPage() {
  const searchParams = useSearchParams();
  const withId = searchParams.get("with") ?? "";
  const withName = decodeURIComponent(searchParams.get("name") ?? "상대방");
  const withLoginId = searchParams.get("loginId")?.trim() || undefined;

  const currentUser = useCurrentUser();
  const [thread, setThread] = useState<InternalMessage[]>([]);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<{ file: File; data: string }[]>([]);
  const listEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadThread = useCallback(async () => {
    if (!currentUser.id || !withId) return;
    try {
      const { data: list } = await fetchInternalMessages("thread", withId);
      setThread(list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      for (const m of list) {
        if (
          (m.recipientId === currentUser.id || String(m.recipientId) === currentUser.id) &&
          !m.readAt
        ) {
          markMessageRead(m.id).catch(() => {});
        }
      }
    } catch {
      setThread([]);
    }
  }, [currentUser.id, withId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  useEffect(() => {
    const interval = setInterval(() => loadThread(), POLL_MS);
    return () => clearInterval(interval);
  }, [loadThread]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected?.length) return;
    const promises = Array.from(selected).map(
      (file) =>
        new Promise<{ file: File; data: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ file, data: reader.result as string });
          reader.readAsDataURL(file);
        })
    );
    Promise.all(promises).then((newFiles) => {
      setFiles((prev) => [...prev, ...newFiles]);
    });
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!currentUser.id || !withId) {
      toast.error("로그인 후 이용해 주세요.");
      return;
    }
    if (!body.trim() && files.length === 0) {
      toast.error("메시지 또는 첨부파일을 입력하세요.");
      return;
    }
    try {
      await sendInternalMessage({
        recipientId: withId,
        recipientName: withName,
        recipientLoginId: withLoginId,
        body: body.trim(),
        attachmentNames: files.map((f) => f.file.name),
        attachmentData: files.map((f) => ({ name: f.file.name, data: f.data })),
      });
      setBody("");
      setFiles([]);
      await loadThread();
      toast.success("전송되었습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "전송 실패");
    }
  };

  const handleDownload = (msg: InternalMessage, name: string) => {
    const data = msg.attachmentData?.find((a) => a.name === name)?.data;
    if (data) {
      const a = document.createElement("a");
      a.href = data;
      a.download = name;
      a.click();
      toast.success(`"${name}" 다운로드되었습니다.`);
    } else {
      toast.error("첨부 데이터가 없습니다.");
    }
  };

  if (!withId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <p className="text-sm text-slate-600">채팅 상대 정보가 없습니다. 수신함에서 메시지를 더블클릭하여 열어 주세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
        <Avatar name={withName} size="sm" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-slate-900 truncate">{withName}</h1>
          <p className="text-xs text-text-muted">1:1 채팅 · 메신저자료실에 보관</p>
        </div>
        <MessageCircle size={20} className="text-primary-500 shrink-0" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {thread.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <User size={40} className="text-slate-300 mb-2" />
            <p className="text-sm text-text-muted">아직 대화가 없습니다.</p>
            <p className="text-xs text-text-muted mt-1">메시지를 보내면 여기에 쌓입니다.</p>
          </div>
        ) : (
          thread.map((m) => {
            const isMe = m.senderId === currentUser.id || String(m.senderId) === currentUser.id;
            return (
              <div
                key={m.id}
                className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}
              >
                {!isMe && (
                  <Avatar name={m.senderName} size="xs" className="shrink-0 mt-1" />
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm",
                    isMe
                      ? "bg-primary-500 text-white rounded-br-md"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-md"
                  )}
                >
                  {!isMe && (
                    <p className="text-xs font-medium text-slate-500 mb-1">{m.senderName}</p>
                  )}
                  {m.body ? (
                    <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                  ) : null}
                  {m.attachmentNames.length > 0 && (
                    <ul className={cn("mt-2 space-y-1.5", m.body ? "border-t border-white/20 pt-2" : "")}>
                      {m.attachmentNames.map((name, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <FileText size={14} className={isMe ? "text-white/90" : "text-slate-400"} />
                          <span className={cn("text-xs truncate flex-1", isMe ? "text-white/95" : "text-slate-600")}>
                            {name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className={isMe ? "text-white hover:bg-white/20" : ""}
                            leftIcon={<Download size={12} />}
                            onClick={() => handleDownload(m, name)}
                          >
                            받기
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p
                    className={cn(
                      "text-[10px] mt-1",
                      isMe ? "text-white/80" : "text-slate-400"
                    )}
                  >
                    {formatChatTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>

      <div className="shrink-0 p-3 bg-white border-t border-slate-200">
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mb-2">
            {files.map((f, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-xs"
              >
                <FileText size={12} className="text-slate-500" />
                <span className="truncate max-w-[120px]">{f.file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-slate-400 hover:text-danger-500 p-0.5"
                  aria-label="제거"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 shrink-0"
            aria-label="첨부"
          >
            <Paperclip size={20} />
          </button>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="메시지 입력... (Enter 전송, Shift+Enter 줄바꿈)"
            rows={2}
            className={cn(
              "flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none",
              "focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
            )}
          />
          <Button
            type="button"
            onClick={handleSend}
            className="shrink-0 rounded-xl"
            leftIcon={<Send size={18} />}
          >
            전송
          </Button>
        </div>
      </div>
    </div>
  );
}
