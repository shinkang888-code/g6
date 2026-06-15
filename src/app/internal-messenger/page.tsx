"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Send,
  Paperclip,
  User,
  FileText,
  Download,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { InternalMessage } from "@/lib/types";
import type { StaffMember } from "@/lib/types";
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

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function InternalMessengerPage() {
  const currentUser = useCurrentUser();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [sentList, setSentList] = useState<InternalMessage[]>([]);
  const [receivedList, setReceivedList] = useState<InternalMessage[]>([]);
  const [recipients, setRecipients] = useState<{ id: string; name: string; loginId?: string }[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<{ file: File; data: string }[]>([]);
  const [expandedReceivedId, setExpandedReceivedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const myId = currentUser.id;
  const myLoginId = currentUser.loginId;

  useEffect(() => {
    fetch("/api/staff", { credentials: "include", cache: "no-store" })
      .then((r) => r.json().catch(() => ({})) as Promise<{ staff?: StaffMember[] }>)
      .then((d) => {
        setStaffLoaded(true);
        setStaffList(Array.isArray(d?.staff) ? d.staff : []);
      })
      .catch(() => setStaffLoaded(true));
  }, []);

  const refresh = useCallback(async () => {
    if (!currentUser.id) return;
    try {
      const [sent, received] = await Promise.all([
        fetchInternalMessages("sent"),
        fetchInternalMessages("received"),
      ]);
      setSentList(sent.data);
      setReceivedList(received.data);
    } catch {
      setSentList([]);
      setReceivedList([]);
    }
  }, [currentUser.id]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const allMessages = useMemo(() => {
    const map = new Map<string, InternalMessage>();
    [...sentList, ...receivedList].forEach((m) => {
      if (m.id) map.set(m.id, m);
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [sentList, receivedList]);

  const isRecipient = useCallback(
    (m: InternalMessage) => {
      const rid = String(m.recipientId ?? "").trim();
      const rLogin = String(
        (m as InternalMessage & { recipientLoginId?: string }).recipientLoginId ?? ""
      ).trim().toLowerCase();
      const meId = String(myId ?? "").trim();
      const meLogin = String(myLoginId ?? "").trim().toLowerCase();
      if (meId && rid && meId === rid) return true;
      if (meLogin && rLogin && meLogin === rLogin) return true;
      return false;
    },
    [myId, myLoginId]
  );

  const unreadCount = useMemo(
    () => allMessages.filter((m) => isRecipient(m) && !m.readAt).length,
    [allMessages, isRecipient]
  );

  const isCurrentUser = useCallback(
    (s: StaffMember) =>
      s.id === currentUser.id || (currentUser.loginId && s.loginId === currentUser.loginId),
    [currentUser.id, currentUser.loginId]
  );
  const staffOptions = staffList.filter((s) => !isCurrentUser(s));
  const recipientIds = new Set(recipients.map((r) => r.id));
  const q = recipientSearch.trim().toLowerCase();
  const filteredStaff = q
    ? staffOptions.filter(
        (s) =>
          !recipientIds.has(s.id) &&
          (s.name.toLowerCase().includes(q) ||
            (s.department && s.department.toLowerCase().includes(q)) ||
            (s.role && s.role.toLowerCase().includes(q)))
      )
    : staffOptions.filter((s) => !recipientIds.has(s.id));

  const addRecipient = (id: string, name: string, loginId?: string) => {
    if (recipientIds.has(id)) return;
    setRecipients((prev) => [...prev, { id, name, loginId }]);
    setRecipientSearch("");
  };
  const removeRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

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
    if (recipients.length === 0) {
      toast.error("수신자를 1명 이상 선택하세요. 이름을 입력한 뒤 목록에서 선택하세요.");
      return;
    }
    if (!body.trim() && files.length === 0) {
      toast.error("메시지 내용 또는 첨부파일을 입력하세요.");
      return;
    }
    try {
      await sendInternalMessage({
        body: body.trim(),
        attachmentNames: files.map((f) => f.file.name),
        attachmentData: files.map((f) => ({ name: f.file.name, data: f.data })),
        recipients: recipients.map((r) => ({
          recipientId: r.id,
          recipientName: r.name,
          recipientLoginId: r.loginId,
        })),
      });
      setBody("");
      setFiles([]);
      setRecipients([]);
      await refresh();
      toast.success(`${recipients.length}명에게 발송했습니다.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "전송 실패");
    }
  };

  const handleExpandReceived = async (msg: InternalMessage) => {
    setExpandedReceivedId((id) => (id === msg.id ? null : msg.id));
    if (!msg.readAt && isRecipient(msg)) {
      try {
        await markMessageRead(msg.id);
      } catch {
        /* ignore */
      }
    }
    refresh();
  };

  const handleDownloadAttachment = (msg: InternalMessage, name: string, data?: string) => {
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

  return (
    <div className="min-h-screen bg-slate-50">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="p-5 max-w-6xl mx-auto space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <MessageCircle size={22} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">사내 메신저</h1>
            <p className="text-sm text-text-muted">
              직원 간 문자 메시지와 첨부파일을 송수신할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 좌측: 문서 발신 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Send size={18} className="text-primary-600" />
              <h2 className="text-sm font-semibold text-slate-800">문서 발신</h2>
            </div>
            <div className="p-5 flex flex-col flex-1 min-h-0">
              <div className="space-y-3 mb-4">
                <label className="block text-xs font-medium text-slate-600">수신자 (이름 입력 후 여러 명 선택 가능)</label>
                <input
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  placeholder="이름 또는 부서로 검색"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                />
                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {recipients.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary-50 border border-primary-200 rounded-lg text-sm"
                      >
                        <span className="font-medium text-slate-800">{r.name}</span>
                        <button
                          type="button"
                          onClick={() => removeRecipient(r.id)}
                          className="text-slate-400 hover:text-danger-500 p-0.5"
                          aria-label="제거"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="max-h-[7rem] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {!staffLoaded ? (
                    <div className="px-3 py-3 text-xs text-text-muted text-center">
                      수신 후보 목록을 불러오는 중…
                    </div>
                  ) : filteredStaff.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-text-muted text-center">
                      {recipientSearch.trim()
                        ? "검색 결과가 없습니다."
                        : staffOptions.length === 0
                          ? "승인된 회원이 없습니다. 회원 관리에서 승인한 회원이 여기에 표시됩니다."
                          : "이름 또는 부서를 입력하면 수신 후보가 표시됩니다."}
                    </div>
                  ) : (
                    filteredStaff.slice(0, 20).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addRecipient(s.id, s.name, s.loginId)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <User size={14} className="text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800">{s.name}</span>
                        <span className="text-xs text-text-muted">
                          {[s.role, s.department].filter(Boolean).join(" · ") || "직원"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <label className="block text-xs font-medium text-slate-600">메시지</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  rows={4}
                  className={cn(
                    "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none",
                    "focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
                  )}
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    leftIcon={<Paperclip size={14} />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    첨부파일
                  </Button>
                  {files.length > 0 && (
                    <span className="text-xs text-text-muted">
                      {files.length}개 첨부
                    </span>
                  )}
                </div>
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-700">
                        <FileText size={12} className="text-slate-400" />
                        <span className="truncate flex-1">{f.file.name}</span>
                        <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-danger-500">
                          <X size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  type="button"
                  className="w-full"
                  leftIcon={<Send size={14} />}
                  onClick={handleSend}
                >
                  전송
                </Button>
              </div>
              <div className="border-t border-slate-100 pt-4 flex-1 min-h-0 flex flex-col">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  발신 목록
                </div>
                <div className="flex-1 min-h-[120px] overflow-y-auto space-y-2">
                  {sentList.length === 0 ? (
                    <p className="text-xs text-text-muted py-4 text-center">발신한 메시지가 없습니다.</p>
                  ) : (
                    sentList.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 text-left"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-800">{m.recipientName}</span>
                          <span className="text-xs text-text-muted">{formatMessageTime(m.createdAt)}</span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">{m.body || "(첨부만)"}</p>
                        {m.attachmentNames.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
                            <Paperclip size={10} />
                            {m.attachmentNames.length}개 파일
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 우측: 문서 수발신 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <User size={18} className="text-primary-600" />
              <h2 className="text-sm font-semibold text-slate-800">문서 수발신</h2>
              {unreadCount > 0 && (
                <span className="ml-auto text-xs font-medium text-primary-600 bg-primary-100 rounded-full px-2 py-0.5">
                  {unreadCount}건 읽지 않음
                </span>
              )}
            </div>
            <div className="p-5 flex-1 min-h-0 overflow-y-auto">
              {allMessages.length === 0 ? (
                <p className="text-xs text-text-muted py-8 text-center">수신·발신한 메시지가 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {allMessages.map((m) => {
                    const isExpanded = expandedReceivedId === m.id;
                    const fullMsg = m;
                    const sentByMe = String(m.senderId ?? "") === String(myId ?? "");
                    const counterpartName = sentByMe ? m.recipientName : m.senderName;
                    const openChat = () => {
                      const otherId = sentByMe ? m.recipientId : m.senderId;
                      const otherName = counterpartName;
                      if (!otherId) return;
                      markMessageRead(m.id).catch(() => {});
                      refresh();
                      const url = `/internal-messenger/chat?with=${encodeURIComponent(
                        String(otherId)
                      )}&name=${encodeURIComponent(otherName)}`;
                      window.open(url, "_blank", "width=420,height=700,scrollbars=yes,resizable=yes");
                    };
                    return (
                      <li
                        key={m.id}
                        onDoubleClick={openChat}
                        className={cn(
                          "rounded-xl border transition-colors cursor-pointer",
                          isExpanded ? "border-primary-200 bg-primary-50/50" : "border-slate-100 hover:border-slate-200"
                        )}
                        title="더블클릭: 1:1 채팅창 열기"
                      >
                        <button
                          type="button"
                          onClick={() => handleExpandReceived(m)}
                          className="w-full flex items-center gap-3 p-3 text-left"
                        >
                          <Avatar name={counterpartName} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-800">
                                {counterpartName}
                              </span>
                              <span
                                className={cn(
                                  "text-[11px] px-1.5 py-0.5 rounded-full border",
                                  sentByMe
                                    ? "border-sky-200 bg-sky-50 text-sky-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                )}
                              >
                                {sentByMe ? "발신" : "수신"}
                              </span>
                              {!m.readAt && isRecipient(m) && (
                                <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" title="읽지 않음" />
                              )}
                            </div>
                            <p className="text-xs text-text-muted line-clamp-1 mt-0.5">
                              {m.body || (m.attachmentNames.length > 0 ? `첨부 ${m.attachmentNames.length}개` : "")}
                            </p>
                          </div>
                          <span className="text-xs text-text-muted shrink-0">{formatMessageTime(m.createdAt)}</span>
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight size={16} className="text-slate-400 shrink-0" />
                          )}
                        </button>
                        {isExpanded && fullMsg && (
                          <div className="px-3 pb-3 pt-0 border-t border-slate-100 mt-0">
                            <div className="mt-3 p-3 bg-white rounded-lg border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap">
                              {fullMsg.body || "(내용 없음)"}
                            </div>
                            {fullMsg.attachmentNames.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs font-medium text-slate-600 mb-2">첨부파일</div>
                                <ul className="space-y-1.5">
                                  {fullMsg.attachmentNames.map((name, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                      <FileText size={14} className="text-slate-400" />
                                      <span className="text-sm text-slate-700 truncate flex-1">{name}</span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        leftIcon={<Download size={12} />}
                                        onClick={() =>
                                          handleDownloadAttachment(
                                            fullMsg,
                                            name,
                                            fullMsg.attachmentData?.find((a) => a.name === name)?.data
                                          )
                                        }
                                      >
                                        다운로드
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
