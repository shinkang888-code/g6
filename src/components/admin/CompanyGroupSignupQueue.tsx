"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Clock, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { USER_STATUS_LABELS, type SiteUserRow } from "@/lib/userAdmin";

type Props = {
  managementNumber: string;
  refreshKey?: number;
};

export function CompanyGroupSignupQueue({ managementNumber, refreshKey = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<SiteUserRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/company-registry/${managementNumber}/signup-queue`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "목록 조회 실패");
      setQueue(Array.isArray(data.signupQueue) ? data.signupQueue : []);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "가입 신청 목록 조회 실패");
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey, managementNumber]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === queue.length) setSelected(new Set());
    else setSelected(new Set(queue.map((u) => u.id)));
  };

  const runBulk = async (action: "approve" | "hold" | "delete") => {
    const ids = selected.size > 0 ? Array.from(selected) : [];
    if (!ids.length) {
      toast.error("처리할 회원을 선택하세요.");
      return;
    }
    const labels = { approve: "승인", hold: "보류", delete: "삭제" };
    if (action === "delete" && !confirm(`선택한 ${ids.length}명의 가입 신청을 삭제하시겠습니까?`)) return;
    if (action === "approve" && !confirm(`선택한 ${ids.length}명을 가입 승인하시겠습니까?`)) return;

    setActing(true);
    try {
      const res = await fetch("/api/admin/users/signup-review-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `${labels[action]} 실패`);
      toast.success(`${labels[action]} ${data.processed ?? 0}명 처리`);
      if (data.errors?.length) console.warn("bulk partial errors:", data.errors);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${labels[action]} 실패`);
    } finally {
      setActing(false);
    }
  };

  const runSingle = async (id: string, action: "approve" | "hold" | "delete") => {
    setActing(true);
    try {
      if (action === "delete") {
        const res = await fetch("/api/admin/users/signup-review-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ids: [id], action: "delete" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "삭제 실패");
        toast.success("가입 신청을 삭제했습니다.");
      } else {
        const res = await fetch(`/api/admin/users/${id}/signup-review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "처리 실패");
        toast.success(action === "approve" ? "가입 승인했습니다." : "보류 처리했습니다.");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <UserPlus size={18} className="text-primary-600" />
            가입 승인 대기
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            관리번호 <span className="font-mono font-medium">{managementNumber}</span>로 신청한 Google·일반 가입자
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" leftIcon={<CheckSquare size={13} />} onClick={toggleAll} disabled={!queue.length}>
            {selected.size === queue.length && queue.length > 0 ? "선택 해제" : "전체 선택"}
          </Button>
          <Button size="xs" leftIcon={<ShieldCheck size={13} />} disabled={acting} onClick={() => runBulk("approve")}>
            일괄 승인
          </Button>
          <Button size="xs" variant="outline" leftIcon={<Clock size={13} />} disabled={acting} onClick={() => runBulk("hold")}>
            일괄 보류
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="text-danger-600 border-danger-200"
            leftIcon={<Trash2 size={13} />}
            disabled={acting}
            onClick={() => runBulk("delete")}
          >
            일괄 삭제
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="px-5 py-10 text-sm text-center text-text-muted">불러오는 중…</p>
      ) : queue.length === 0 ? (
        <p className="px-5 py-10 text-sm text-center text-text-muted">가입 승인 대기 중인 회원이 없습니다.</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {queue.map((u) => {
            const isGoogle = u.auth_provider === "google" || Boolean(u.google_email);
            const checked = selected.has(u.id);
            return (
              <div
                key={u.id}
                className={cn(
                  "px-5 py-3 flex flex-wrap items-center gap-3",
                  checked && "bg-primary-50/40"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(u.id)}
                  className="rounded border-slate-300"
                  aria-label={`${u.name ?? u.login_id} 선택`}
                />
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-800">{u.name ?? u.login_id}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {USER_STATUS_LABELS[u.status] ?? u.status}
                    </span>
                    {isGoogle && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Google</span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5 font-mono">
                    ID: {u.login_id}
                    {u.google_email ? ` · ${u.google_email}` : u.email ? ` · ${u.email}` : ""}
                  </div>
                  <div className="text-xs text-text-muted">
                    신청일 {u.created_at ? new Date(u.created_at).toLocaleDateString("ko-KR") : "—"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="xs" disabled={acting} onClick={() => runSingle(u.id, "approve")}>
                    승인
                  </Button>
                  <Button size="xs" variant="outline" disabled={acting} onClick={() => runSingle(u.id, "hold")}>
                    보류
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-danger-600"
                    disabled={acting}
                    onClick={() => runSingle(u.id, "delete")}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
