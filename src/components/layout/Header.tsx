"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, ChevronDown, X, LogOut, User } from "lucide-react";
import type { CaseItem, Notification } from "@/lib/types";
import { formatDate, getDDay } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DDayBadge } from "@/components/ui/badge";
import { useGlobalShortcuts } from "@/hooks/useKeyboardShortcuts";

export function Header() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [user, setUser] = useState<{ loginId: string; name: string; role?: string } | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [caseSearchResults, setCaseSearchResults] = useState<CaseItem[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setUser({ loginId: d.user.loginId, name: d.user.name, role: d.user.role });
        else {
          fetch("/api/auth/session", { credentials: "include" })
            .then((r) => r.json())
            .then((s) => s?.user && setUser({ loginId: s.user.loginId, name: s.user.name }));
        }
      })
      .catch(() => {
        fetch("/api/auth/session", { credentials: "include" })
          .then((r) => r.json())
          .then((s) => s?.user && setUser({ loginId: s.user.loginId, name: s.user.name }));
      });
  }, []);

  useEffect(() => {
    const load = () => {
      fetch("/api/notifications", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((json: { data?: Notification[] }) => {
          setNotifications(Array.isArray(json.data) ? json.data.slice(0, 8) : []);
        })
        .catch(() => setNotifications([]));
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  useGlobalShortcuts({
    onSearchFocus: () => searchRef.current?.focus(),
  });

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setCaseSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q, page_size: "6", page: "1" });
      fetch(`/api/admin/cases?${params}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((json: { data?: CaseItem[] }) => {
          setCaseSearchResults(Array.isArray(json.data) ? json.data.slice(0, 6) : []);
        })
        .catch(() => setCaseSearchResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const searchResults = searchQuery.trim() ? caseSearchResults : [];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setSearchFocused(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUserOpen(false);
    router.replace("/login");
    router.refresh();
  };

  const handleBellClick = () => {
    setNotifOpen(!notifOpen);
    if (!notifOpen) {
      setBellRinging(true);
      setTimeout(() => setBellRinging(false), 600);
    }
  };

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <>
    <header className="h-[52px] lg:h-[60px] bg-white border-b border-slate-200 flex items-center px-3 lg:px-4 gap-2 lg:gap-4 sticky top-0 z-30 shrink-0">
      <button
        type="button"
        className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600"
        onClick={() => setMobileSearchOpen(true)}
        aria-label="검색"
      >
        <Search size={20} />
      </button>

      {/* Omnibar — desktop */}
      <div className="hidden lg:block flex-1 max-w-xl relative">
        <div
          className={cn(
            "flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-1.5 transition-all duration-200",
            searchFocused ? "border-primary-400 bg-white shadow-sm ring-2 ring-primary-600/20" : "border-slate-200 hover:border-slate-300"
          )}
        >
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder="의뢰인, 담당, 보조 이름 또는 사건번호..."
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none min-w-0"
          />
          {searchQuery ? (
            <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex text-xs text-slate-400 bg-slate-200 rounded px-1 py-0.5">/</kbd>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {searchFocused && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-up">
            <div className="py-1">
              {searchResults.map((c) => {
                const dday = c.nextDate ? getDDay(c.nextDate) : null;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      router.push(`/cases/${c.id}`);
                      setSearchQuery("");
                      setSearchFocused(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary-600">{c.caseNumber}</span>
                        <span className="text-xs text-slate-400">{c.caseType}</span>
                      </div>
                      <div className="text-sm text-slate-700 truncate">{c.caseName}</div>
                      <div className="text-xs text-text-muted">{c.clientName} · {c.court}</div>
                    </div>
                    {c.nextDate && dday !== null && (
                      <DDayBadge dday={dday} />
                    )}
                  </div>
                );
              })}
            </div>
            <div
              className="border-t border-slate-100 px-3 py-2 text-xs text-text-muted bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => { router.push(`/cases?q=${encodeURIComponent(searchQuery)}`); setSearchQuery(""); setSearchFocused(false); }}
            >
              검색 결과 {searchResults.length}건 · <span className="text-primary-600 font-medium">전체 목록에서 보기 →</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 lg:gap-2 ml-auto">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleBellClick}
            className={cn(
              "relative min-w-[44px] min-h-[44px] lg:w-9 lg:h-9 flex items-center justify-center rounded-lg text-slate-500",
              "hover:bg-slate-100 transition-colors",
              bellRinging && "animate-[bellRing_0.5s_ease-in-out]"
            )}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute top-full right-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-up">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-800">알림</span>
                {unreadCount > 0 && (
                  <span className="text-xs text-primary-600 font-medium">{unreadCount}개 미읽음</span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-text-muted">알림이 없습니다.</div>
                )}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (n.link) router.push(n.link);
                      else router.push("/notifications");
                      setNotifOpen(false);
                    }}
                    className={cn(
                      "flex gap-3 px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors",
                      n.isRead ? "hover:bg-slate-50" : "bg-primary-50/50 hover:bg-primary-50"
                    )}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                      n.type === "urgent_date" ? "bg-danger-500" :
                      n.type === "approval_request" ? "bg-primary-500" :
                      "bg-warning-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">{n.title}</div>
                      <div className="text-xs text-text-muted mt-0.5 truncate">{n.message}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {formatDate(n.createdAt, "time")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 bg-slate-50 text-center">
                <button
                  type="button"
                  onClick={() => { router.push("/notifications"); setNotifOpen(false); }}
                  className="text-xs text-primary-600 font-medium hover:underline"
                >
                  모든 알림 보기
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User profile + logout */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen(!userOpen)}
            className="flex items-center gap-2 px-2 py-1.5 min-h-[44px] rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.name?.slice(0, 1) ?? user?.loginId?.slice(0, 1) ?? "?"}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-sm font-medium text-slate-800 leading-tight">{user?.name || user?.loginId || "사용자"}</div>
              <div className="text-xs text-text-muted leading-tight">{user?.loginId ?? ""}</div>
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
          </button>
          {userOpen && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1">
              <Link
                href="/my"
                onClick={() => setUserOpen(false)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <User size={14} />
                마이페이지
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut size={14} />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Mobile full-screen search */}
    {mobileSearchOpen && (
      <div className="lg:hidden fixed inset-0 z-50 bg-white flex flex-col safe-area-pb">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="의뢰인, 담당, 보조 이름..."
              className="w-full pl-10 pr-3 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-600/15"
            />
          </div>
          <button
            type="button"
            onClick={() => { setMobileSearchOpen(false); setSearchQuery(""); }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-100 text-slate-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {searchResults.map((c) => {
            const dday = c.nextDate ? getDDay(c.nextDate) : null;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  router.push(`/cases/${c.id}`);
                  setSearchQuery("");
                  setMobileSearchOpen(false);
                }}
                className="w-full text-left flex items-center gap-3 px-4 py-4 border-b border-slate-100 hover:bg-slate-50 min-h-[64px]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-primary-600">{c.caseNumber}</div>
                  <div className="text-base font-medium text-slate-800 truncate">{c.caseName}</div>
                  <div className="text-sm text-text-muted truncate">{c.clientName} · {c.court}</div>
                </div>
                {c.nextDate && dday !== null && <DDayBadge dday={dday} />}
              </button>
            );
          })}
          {searchQuery.trim() && searchResults.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-muted">검색 결과가 없습니다.</div>
          )}
          {searchQuery.trim() && searchResults.length > 0 && (
            <button
              type="button"
              className="w-full px-4 py-4 text-sm text-primary-600 font-medium border-t border-slate-100"
              onClick={() => {
                router.push(`/cases?q=${encodeURIComponent(searchQuery)}`);
                setSearchQuery("");
                setMobileSearchOpen(false);
              }}
            >
              전체 목록에서 보기 →
            </button>
          )}
        </div>
      </div>
    )}
    </>
  );
}
