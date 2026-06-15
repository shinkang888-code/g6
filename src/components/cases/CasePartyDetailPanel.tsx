"use client";

import { useEffect, useState } from "react";
import { Phone, Mail, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTrialPrivacy } from "@/hooks/useTrialPrivacy";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileBottomSheet } from "@/components/ui/MobileBottomSheet";
import {
  CASE_PARTY_ROLES,
  partiesByRole,
  type CaseParty,
  type CasePartyRole,
} from "@/lib/casePartyTypes";
import { partyInputFromParty } from "@/lib/casePartyApi";

type Props = {
  caseId: string;
  fallbackClientName?: string;
  fallbackClientPosition?: string;
  fallbackOpponentName?: string;
};

export function CasePartyDetailPanel({
  caseId,
  fallbackClientName,
  fallbackClientPosition,
  fallbackOpponentName,
}: Props) {
  const [parties, setParties] = useState<CaseParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<CasePartyRole>("client");
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useIsMobile();
  const { maskName } = useTrialPrivacy();

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    fetch(`/api/admin/cases/${encodeURIComponent(caseId)}/parties`, { credentials: "include" })
      .then((r) => r.json())
      .then((json: { data?: CaseParty[] }) => {
        setParties(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => setParties([]))
      .finally(() => setLoading(false));
  }, [caseId]);

  const roleList = partiesByRole(
    parties.map(partyInputFromParty),
    activeRole
  ).filter((p) => p.name?.trim());

  const clients = partiesByRole(parties.map(partyInputFromParty), "client").filter((p) =>
    p.name?.trim()
  );
  const opponents = partiesByRole(parties.map(partyInputFromParty), "opponent").filter((p) =>
    p.name?.trim()
  );

  const summaryClient =
    maskName(clients[0]?.name?.trim() || fallbackClientName?.trim() || "");
  const summaryPosition =
    clients[0]?.position?.trim() || fallbackClientPosition?.trim() || "";

  if (loading) {
    return <p className="text-xs text-text-muted">당사자 정보 불러오는 중…</p>;
  }

  const hasData =
    clients.length > 0 ||
    opponents.length > 0 ||
    parties.some((p) => p.role === "third_party") ||
    Boolean(fallbackClientName?.trim());

  if (!hasData) return null;

  const panelBody = (
    <div className="space-y-3">
      <div className={cn("flex gap-1.5", isMobile && "overflow-x-auto pb-1")}>
        {CASE_PARTY_ROLES.map((r) => {
          const count = partiesByRole(parties.map(partyInputFromParty), r.value).filter((p) =>
            p.name?.trim()
          ).length;
          if (count === 0) return null;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => setActiveRole(r.value)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border",
                activeRole === r.value
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              )}
            >
              {r.shortLabel} ({count})
            </button>
          );
        })}
      </div>

      <ul className="space-y-2">
        {roleList.map((p) => {
          const full = parties.find(
            (x) => x.role === p.role && x.sortOrder === p.sortOrder && x.name === p.name
          );
          return (
            <li
              key={full?.id ?? `${p.role}-${p.sortOrder}`}
              className="rounded-lg border border-slate-100 p-2.5 space-y-1"
            >
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                <User size={13} className="text-slate-400" />
                {maskName(p.name)}
                {p.position && (
                  <span className="text-xs font-normal text-slate-500">({p.position})</span>
                )}
              </div>
              {full?.mobile && (
                <a
                  href={`tel:${full.mobile.replace(/\s/g, "")}`}
                  className="flex items-center gap-1.5 text-xs text-primary-600"
                >
                  <Phone size={11} />
                  {full.mobile}
                </a>
              )}
              {full?.phone && (
                <a
                  href={`tel:${full.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-1.5 text-xs text-primary-600"
                >
                  <Phone size={11} />
                  {full.phone}
                </a>
              )}
              {full?.email && (
                <a href={`mailto:${full.email}`} className="flex items-center gap-1.5 text-xs text-primary-600">
                  <Mail size={11} />
                  {full.email}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-xs"
        >
          <span className="font-medium text-slate-700">당사자</span>
          {summaryClient && (
            <span className="block text-slate-500 mt-0.5 truncate">
              {summaryClient}
              {summaryPosition ? ` (${summaryPosition})` : ""}
            </span>
          )}
        </button>
        <MobileBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="당사자">
          {panelBody}
        </MobileBottomSheet>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">당사자 상세</div>
      {panelBody}
    </div>
  );
}
