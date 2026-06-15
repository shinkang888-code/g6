"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgencyNameAutocomplete } from "@/components/cases/AgencyNameAutocomplete";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { copyScourtFieldsToClipboard, openScourtMyCaseSearch } from "@/lib/scourtLinks";
import {
  notifyScourtSyncOpener,
  runCourtCaseSearch,
  type ScourtBotOutcome,
} from "@/lib/scourtSearchClient";
import { ArrowLeft, ExternalLink, Bot, Loader2, Link2 } from "lucide-react";

/** "2026노107" → { year, gubun, serial } */
function parseCaseNumber(caseNumber: string): { year: string; gubun: string; serial: string } {
  const m = (caseNumber ?? "").replace(/\s/g, "").match(/^(\d{4})([가-힣A-Za-z]+)(\d+)$/);
  return m ? { year: m[1], gubun: m[2], serial: m[3] } : { year: "", gubun: "", serial: "" };
}

export default function ScourtSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [caseId, setCaseId] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [partyName, setPartyName] = useState("");
  const [courtName, setCourtName] = useState("");
  const [scourtOpened, setScourtOpened] = useState(false);
  const [returnPrompt, setReturnPrompt] = useState(false);
  const autoOpenedRef = useRef(false);
  const returnTo = searchParams.get("returnTo") ?? "";

  const [botLoading, setBotLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [outcome, setOutcome] = useState<ScourtBotOutcome | null>(null);
  const [linkResult, setLinkResult] = useState<{
    ok?: boolean;
    caseNumber?: string;
    eventsAdded?: number;
    eventsUpdated?: number;
    eventsRemoved?: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const cn = searchParams.get("caseNumber");
    const pn = searchParams.get("partyName");
    const ct = searchParams.get("court");
    const cid = searchParams.get("caseId");
    if (cn) setCaseNumber(decodeURIComponent(cn));
    if (pn) setPartyName(decodeURIComponent(pn));
    if (ct) setCourtName(decodeURIComponent(ct));
    if (cid) setCaseId(decodeURIComponent(cid));
  }, [searchParams]);

  const parsed = parseCaseNumber(caseNumber);
  const canSearch =
    courtName.trim() !== "" &&
    parsed.year !== "" &&
    parsed.gubun !== "" &&
    parsed.serial !== "" &&
    partyName.trim().length >= 2;

  const buildJob = useCallback(
    () => ({
      courtName: courtName.trim(),
      year: parsed.year,
      gubun: parsed.gubun,
      serial: parsed.serial,
      partyName: partyName.trim(),
    }),
    [courtName, parsed.year, parsed.gubun, parsed.serial, partyName]
  );

  const handleOpenScourt = useCallback(async () => {
    const copied = await copyScourtFieldsToClipboard(caseNumber, partyName, courtName);
    openScourtMyCaseSearch();
    setScourtOpened(true);
    setReturnPrompt(false);
    toast.success(
      copied
        ? "검색 정보가 복사되었습니다. 나의사건검색 탭에서 붙여넣기 후 이 화면으로 돌아와 [조회완료·기일연동]을 눌러주세요."
        : "나의 사건검색이 새 탭에서 열렸습니다. 조회 완료 후 [조회완료·기일연동]을 눌러주세요."
    );
  }, [caseNumber, partyName, courtName]);

  useEffect(() => {
    if (searchParams.get("autoOpen") !== "1" || autoOpenedRef.current || !canSearch) return;
    autoOpenedRef.current = true;
    void handleOpenScourt();
  }, [searchParams, canSearch, handleOpenScourt]);

  useEffect(() => {
    if (!scourtOpened) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setReturnPrompt(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [scourtOpened]);

  const navigateBack = useCallback(() => {
    if (returnTo) {
      router.push(returnTo);
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/cases");
  }, [returnTo, router]);

  const handleLinkDeadlines = async () => {
    if (!caseId) {
      setErrorMsg("연동할 사건이 지정되지 않았습니다. 사건 목록·상세에서 다시 열어주세요.");
      return;
    }
    if (!canSearch) {
      setErrorMsg("기관·사건번호·당사자명을 모두 입력해 주세요.");
      return;
    }

    setLinkLoading(true);
    setErrorMsg("");
    setLinkResult(null);
    setReturnPrompt(false);
    try {
      const res = await fetch("/api/cases/scourt-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ caseId, job: buildJob() }),
      });
      const json = await res.json();
      setLinkResult(json);

      if (json.ok) {
        if (json.skippedNoChange) {
          toast.success(`${json.caseNumber} — 기일 변경 없음`);
        } else {
          const parts = [
            json.eventsAdded ? `추가 ${json.eventsAdded}` : "",
            json.eventsUpdated ? `수정 ${json.eventsUpdated}` : "",
            json.eventsRemoved ? `삭제 ${json.eventsRemoved}` : "",
          ].filter(Boolean);
          toast.success(
            `${json.caseNumber} — ${parts.length ? parts.join(", ") : "기일 연동 완료"}`
          );
        }
        notifyScourtSyncOpener({ caseId, ok: true, result: json });

        if (returnTo) {
          setTimeout(() => navigateBack(), 800);
        }
      } else {
        const msg = json.error ?? json.skipReason ?? "기일 연동 실패";
        setErrorMsg(msg);
        toast.error(msg);
        notifyScourtSyncOpener({ caseId, ok: false, error: msg });
      }
    } catch {
      const msg = "네트워크 오류로 기일 연동에 실패했습니다.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLinkLoading(false);
    }
  };

  const handleBotSearch = async () => {
    setBotLoading(true);
    setOutcome(null);
    setErrorMsg("");
    try {
      const result = await runCourtCaseSearch(buildJob());
      setOutcome(result);
      if (result?.error) setErrorMsg(result.error);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "조회에 실패했습니다.");
    } finally {
      setBotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-sm mx-auto">
        {returnTo ? (
          <button
            type="button"
            onClick={navigateBack}
            className="inline-flex items-center gap-1 text-xs text-slate-600 mb-3 hover:text-primary-700"
          >
            <ArrowLeft size={14} />
            사건 목록으로
          </button>
        ) : null}

        <h1 className="text-lg font-semibold text-slate-800 mb-1">나의사건검색 연동</h1>
        <p className="text-xs text-text-muted mb-4">
          1) <strong>나의 사건검색</strong> 탭에서 조회를 완료합니다. 2) 이 화면으로 돌아와{" "}
          <strong>조회완료·기일연동</strong>을 누르면 봇이 조회 결과를 파싱해 사건 기일에 반영합니다.
          기일연동 시 봇이 <strong>사건검색 결과 저장</strong>을 자동 체크하여 PC와 동일한 조회 데이터를
          확보합니다. (대법원 사이트는 보안상 LawyGo로 직접 전달되지 않아 이 보조 화면이 필요합니다.)
        </p>

        {caseId ? (
          <p className="text-[11px] text-primary-700 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 mb-4">
            연동 대상: <span className="font-medium">{caseNumber || "사건번호"}</span>
            {partyName ? ` · ${partyName}` : ""}
          </p>
        ) : (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
            사건 ID가 없습니다. 사건 목록·상세에서 열면 기일 연동이 가능합니다.
          </p>
        )}

        {returnPrompt && (
          <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 text-xs text-primary-800">
            나의사건검색 조회를 완료하셨나요? 아래 <strong>조회완료·기일연동</strong>을 눌러 기일을
            가져오세요.
          </div>
        )}

        <div className="space-y-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">기관(자동조회시필수)</label>
            <AgencyNameAutocomplete
              value={courtName}
              onChange={setCourtName}
              scope="scourt"
              placeholder="예: 서울중앙지방법원"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">사건번호</label>
            <input
              type="text"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              placeholder="예: 2025가소32949"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
            />
            {caseNumber && (
              <p className="mt-1 text-[11px] text-text-muted">
                {parsed.year
                  ? `${parsed.year}년 · ${parsed.gubun} · ${parsed.serial}`
                  : "형식: 연도+사건구분+번호 (예: 2025가소32949)"}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">당사자(의뢰인 등)</label>
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="당사자명 입력 (2자 이상)"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20 outline-none"
            />
          </div>

          <Button
            type="button"
            onClick={() => void handleOpenScourt()}
            className="w-full min-h-[44px]"
            leftIcon={<ExternalLink size={14} />}
          >
            나의 사건검색 열기
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handleLinkDeadlines}
            className="w-full min-h-[44px]"
            disabled={!caseId || !canSearch || linkLoading}
            leftIcon={linkLoading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
          >
            {linkLoading ? "조회 결과 파싱 · 기일 반영 중…" : "조회완료 · 기일연동"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleBotSearch}
            className="w-full"
            disabled={!canSearch || botLoading}
            leftIcon={botLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
          >
            {botLoading ? "봇이 조회 중… (캡차 처리)" : "봇으로 자동 조회 (미리보기)"}
          </Button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-danger-200 bg-danger-50 p-3 text-xs text-danger-700 whitespace-pre-line">
            {errorMsg}
          </div>
        )}

        {linkResult?.ok && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
            <p className="font-semibold mb-1">기일 연동 완료</p>
            <p>
              {String(linkResult.caseNumber ?? "")} — 추가 {String(linkResult.eventsAdded ?? 0)}, 수정{" "}
              {String(linkResult.eventsUpdated ?? 0)}, 삭제 {String(linkResult.eventsRemoved ?? 0)}
            </p>
          </div>
        )}

        {outcome && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-sm">
            {outcome.error ? (
              <p className="text-danger-600 text-xs">오류: {outcome.error}</p>
            ) : outcome.notFound ? (
              <p className="text-text-muted text-xs">
                조회 결과가 없습니다. (캡차 {outcome.captchaAttempts ?? 0}회) 기관·사건번호·당사자명을
                확인하세요.
              </p>
            ) : outcome.data ? (
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-800">
                  {outcome.data.caseNumber} {outcome.data.caseName ?? ""}
                </p>
                <Row label="기관" value={outcome.data.court} />
                <Row label="재판부" value={outcome.data.court_division} />
                <Row label="당사자" value={outcome.data.defendantName} />
                <Row label="접수일" value={outcome.data.receivedDate} />
                <Row label="종국결과" value={outcome.data.finalResult} />
                {outcome.data.events && outcome.data.events.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-600 mb-1">
                      진행/기일 ({outcome.data.events.length})
                    </p>
                    <ul className="space-y-1">
                      {outcome.data.events.slice(0, 10).map((ev, i) => (
                        <li key={i} className="text-[11px] text-text-muted">
                          {[ev.date, ev.type, ev.detail, ev.result].filter(Boolean).join(" · ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <p className="text-xs text-slate-600">
      <span className="inline-block w-14 text-text-muted">{label}</span>
      {value}
    </p>
  );
}
