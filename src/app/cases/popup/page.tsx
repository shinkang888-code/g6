"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CASE_ACTIVE_TAB_STORAGE_KEY,
  CASE_DETAIL_POPUP_NAME,
  CASE_POPUP_CHANNEL,
  CASE_TAB_ACK_TYPE,
  CASE_TAB_MESSAGE_TYPE,
  CASE_TABS_STORAGE_KEY,
  type CaseDetailTab,
  type CaseTabOpenMessage,
  addOrActivateCaseDetailTab,
  getCaseDetailEmbedUrl,
  loadActiveCaseDetailTabId,
  loadCaseDetailTabs,
  saveCaseDetailTabs,
} from "@/lib/caseDetailPopup";

export default function CaseDetailPopupPage() {
  const searchParams = useSearchParams();
  const [tabs, setTabs] = useState<CaseDetailTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const applyTabs = useCallback((nextTabs: CaseDetailTab[], nextActiveId: string | null) => {
    setTabs(nextTabs);
    setActiveId(nextActiveId);
    saveCaseDetailTabs(nextTabs, nextActiveId);
  }, []);

  const openTab = useCallback(
    (caseId: string, caseNumber: string) => {
      if (!caseId) return;
      setTabs((prev) => {
        const { tabs: nextTabs, activeId: nextActiveId } = addOrActivateCaseDetailTab(
          prev,
          caseId,
          caseNumber
        );
        setActiveId(nextActiveId);
        saveCaseDetailTabs(nextTabs, nextActiveId);
        return nextTabs;
      });
    },
    []
  );

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId);
      if (idx < 0) return prev;

      const nextTabs = prev.filter((t) => t.id !== tabId);
      setActiveId((currentActive) => {
        const nextActiveId =
          currentActive === tabId
            ? (nextTabs[idx] ?? nextTabs[idx - 1] ?? null)?.id ?? null
            : currentActive;
        saveCaseDetailTabs(nextTabs, nextActiveId);
        return nextActiveId;
      });
      return nextTabs;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.name = CASE_DETAIL_POPUP_NAME;
    if (window.opener && !window.opener.closed) {
      window.opener.__lawygoCaseDetailPopup = window;
    }

    const storedTabs = loadCaseDetailTabs();
    const storedActive = loadActiveCaseDetailTabId();
    const initialCaseId = searchParams.get("caseId");
    const initialCaseNumber = searchParams.get("caseNumber") ?? initialCaseId ?? "";

    let nextTabs = storedTabs;
    let nextActiveId = storedActive;

    if (initialCaseId) {
      const result = addOrActivateCaseDetailTab(nextTabs, initialCaseId, initialCaseNumber);
      nextTabs = result.tabs;
      nextActiveId = result.activeId;
    }

    applyTabs(nextTabs, nextActiveId);
    setReady(true);

    if (initialCaseId) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, [searchParams, applyTabs]);

  useEffect(() => {
    if (!ready) return;

    const handleOpen = (data: CaseTabOpenMessage, ack?: () => void) => {
      if (data?.type !== CASE_TAB_MESSAGE_TYPE || !data.caseId) return;
      openTab(data.caseId, data.caseNumber || data.caseId);
      window.focus();
      ack?.();
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      handleOpen(event.data as CaseTabOpenMessage);
    };

    const channel = new BroadcastChannel(CASE_POPUP_CHANNEL);
    channel.onmessage = (event) => {
      handleOpen(event.data as CaseTabOpenMessage, () => {
        channel.postMessage({ type: CASE_TAB_ACK_TYPE });
      });
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      channel.close();
    };
  }, [ready, openTab]);

  useEffect(() => {
    const onUnload = () => {
      sessionStorage.removeItem(CASE_TABS_STORAGE_KEY);
      sessionStorage.removeItem(CASE_ACTIVE_TAB_STORAGE_KEY);
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const activeTab = tabs.find((t) => t.id === activeId) ?? null;

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      <header className="shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
          <Scale size={16} className="text-primary-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-800">사건 상세</span>
          <span className="text-xs text-slate-400">탭으로 여러 사건을 동시에 열 수 있습니다</span>
        </div>
        <div className="flex items-end gap-0.5 px-2 pt-1 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => {
            const isActive = tab.id === activeId;
            return (
              <div
                key={tab.id}
                className={cn(
                  "group flex items-center gap-1 max-w-[200px] rounded-t-lg border border-b-0 px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-slate-100 border-slate-200 text-primary-700"
                    : "bg-white border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(tab.id);
                    saveCaseDetailTabs(tabs, tab.id);
                  }}
                  className="truncate text-left"
                  title={tab.caseNumber}
                >
                  {tab.caseNumber}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "shrink-0 p-0.5 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  title="탭 닫기"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </header>

      <main className="flex-1 min-h-0 relative bg-white">
        {tabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Scale size={40} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">열린 사건이 없습니다</p>
            <p className="text-xs text-slate-400 mt-1">사건 관리 목록에서 사건번호를 클릭하세요.</p>
          </div>
        ) : (
          tabs.map((tab) => (
            <iframe
              key={tab.id}
              title={`사건 ${tab.caseNumber}`}
              src={getCaseDetailEmbedUrl(tab.caseId)}
              className={cn(
                "absolute inset-0 w-full h-full border-0 bg-white",
                tab.id === activeId ? "visible" : "invisible pointer-events-none"
              )}
            />
          ))
        )}
        {tabs.length > 0 && !activeTab && (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            탭을 선택하세요
          </div>
        )}
      </main>
    </div>
  );
}
