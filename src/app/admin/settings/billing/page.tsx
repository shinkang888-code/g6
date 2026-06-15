"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  RefreshCw,
  Shield,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type SubscriptionView = {
  managementNumber: string;
  status: string;
  planName: string;
  planAmountKrw: number;
  billingProvider: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  graceUntil: string | null;
  lastPaymentAt: string | null;
  stripeConfigured: boolean;
  danalConfigured: boolean;
  canManageBilling: boolean;
};

type PaymentEvent = {
  id: string;
  provider: string;
  event_type: string;
  amount: number | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  trialing: "체험 중",
  active: "이용 중",
  past_due: "결제 유예",
  suspended: "정지",
  cancelled: "해지",
};

function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return iso.slice(0, 10);
}

export default function AdminBillingSettingsPage() {
  const searchParams = useSearchParams();
  const danalFormRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<"stripe" | "danal" | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [danalForm, setDanalForm] = useState<{
    actionUrl: string;
    formFields: Record<string, string>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subscription/status", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "조회 실패");
      setSubscription(data.subscription ?? null);
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "구독 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const stripe = searchParams.get("stripe");
    const danal = searchParams.get("danal");
    if (stripe === "success") toast.success("Stripe 구독 결제가 완료되었습니다.");
    if (stripe === "cancel") toast.error("Stripe 결제가 취소되었습니다.");
    if (danal === "success") toast.success("다날 결제가 완료되었습니다.");
    if (danal === "fail") toast.error("다날 결제에 실패했습니다.");
  }, [searchParams]);

  useEffect(() => {
    if (danalForm && danalFormRef.current) {
      danalFormRef.current.submit();
      setDanalForm(null);
    }
  }, [danalForm]);

  const startStripe = async () => {
    setPaying("stripe");
    try {
      const res = await fetch("/api/subscription/checkout/stripe", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Stripe 결제 시작 실패");
      if (data.url) window.location.href = data.url;
      else throw new Error("결제 URL이 없습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stripe 결제 실패");
    } finally {
      setPaying(null);
    }
  };

  const startDanal = async () => {
    setPaying("danal");
    try {
      const res = await fetch("/api/subscription/checkout/danal", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "다날 결제 시작 실패");
      setDanalForm({ actionUrl: data.actionUrl, formFields: data.formFields });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "다날 결제 실패");
      setPaying(null);
    }
  };

  const status = subscription?.status ?? "unknown";
  const statusLabel = STATUS_LABELS[status] ?? status;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-primary-600 mb-3"
        >
          <ArrowLeft size={16} />
          시스템 설정
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CreditCard size={26} className="text-primary-600" />
          구독·결제
        </h1>
        <p className="text-sm text-text-muted mt-1">
          관리번호별 월 구독 결제(Stripe / 다날)를 관리합니다. 결제가 완료되면 회사 계정 이용이 활성화됩니다.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-12 justify-center">
          <Loader2 size={18} className="animate-spin" />
          구독 정보 불러오는 중…
        </div>
      ) : subscription ? (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-text-muted">관리번호</p>
                <p className="text-lg font-bold text-slate-900">{subscription.managementNumber}</p>
              </div>
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold",
                  status === "active" || status === "trialing"
                    ? "bg-emerald-50 text-emerald-700"
                    : status === "past_due"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-red-50 text-red-700"
                )}
              >
                {statusLabel}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-text-muted text-xs">요금제</p>
                <p className="font-semibold text-slate-900">{subscription.planName}</p>
                <p className="text-primary-600 font-bold mt-1">
                  월 {formatKrw(subscription.planAmountKrw)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-text-muted text-xs">이용 기간</p>
                <p className="font-medium text-slate-800">
                  ~ {formatDate(subscription.currentPeriodEnd)}
                </p>
                {subscription.trialEndsAt && status === "trialing" && (
                  <p className="text-xs text-amber-700 mt-1">
                    체험 종료: {formatDate(subscription.trialEndsAt)}
                  </p>
                )}
                {subscription.graceUntil && status === "past_due" && (
                  <p className="text-xs text-amber-700 mt-1">
                    유예 기한: {formatDate(subscription.graceUntil)}
                  </p>
                )}
              </div>
            </div>

            {subscription.lastPaymentAt && (
              <p className="text-xs text-text-muted">
                최근 결제: {formatDate(subscription.lastPaymentAt)}
                {subscription.billingProvider ? ` · ${subscription.billingProvider}` : ""}
              </p>
            )}

            {(status === "suspended" || status === "past_due" || status === "cancelled") && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
                <Shield size={16} className="shrink-0 mt-0.5" />
                <p>
                  구독이 정지·만료된 상태입니다. 사내관리자가 결제를 완료하면 일반 직원 계정 이용이
                  자동으로 재개됩니다.
                </p>
              </div>
            )}
          </div>

          {subscription.canManageBilling && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
              <h2 className="font-semibold text-slate-900">월 구독 결제</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1 min-h-[48px]"
                  leftIcon={<CreditCard size={16} />}
                  onClick={startStripe}
                  disabled={!subscription.stripeConfigured || paying !== null}
                >
                  {paying === "stripe" ? "이동 중…" : "Stripe 카드 결제"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 min-h-[48px]"
                  leftIcon={<Wallet size={16} />}
                  onClick={startDanal}
                  disabled={!subscription.danalConfigured || paying !== null}
                >
                  {paying === "danal" ? "이동 중…" : "다날 결제"}
                </Button>
              </div>
              {!subscription.stripeConfigured && !subscription.danalConfigured && (
                <p className="text-xs text-amber-700">
                  결제 모듈이 설정되지 않았습니다. STRIPE_SECRET_KEY 또는 DANAL_CPID/DANAL_CPPWD를
                  환경 변수에 추가하세요.
                </p>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900">결제 이력</h2>
              <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />} onClick={load}>
                새로고침
              </Button>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">결제 이력이 없습니다.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <li key={ev.id} className="py-2.5 flex justify-between gap-3 text-sm">
                    <div>
                      <span className="font-medium text-slate-800">{ev.event_type}</span>
                      <span className="text-text-muted ml-2">{ev.provider}</span>
                    </div>
                    <div className="text-right shrink-0">
                      {ev.amount != null && (
                        <span className="text-slate-700">{formatKrw(ev.amount)}</span>
                      )}
                      <p className="text-xs text-text-muted">{formatDate(ev.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-text-muted">구독 정보를 표시할 수 없습니다.</p>
      )}

      {danalForm && (
        <form
          ref={danalFormRef}
          method="POST"
          action={danalForm.actionUrl}
          className="hidden"
        >
          {Object.entries(danalForm.formFields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      )}
    </div>
  );
}
