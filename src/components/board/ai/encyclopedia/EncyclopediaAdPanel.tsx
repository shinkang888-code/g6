// filepath: src/components/board/ai/encyclopedia/EncyclopediaAdPanel.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerItem = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
};

type Props = {
  placement?: string;
  className?: string;
  /** PatentMultiFaceCanvas 내장 시 aside 래퍼 생략 */
  embedded?: boolean;
};

export function EncyclopediaAdPanel({ placement = "legal_encyclopedia", className, embedded }: Props) {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/banners?placement=${encodeURIComponent(placement)}`, {
        credentials: "include",
      });
      const json = await res.json();
      setBanners(Array.isArray(json.data) ? json.data : []);
    } catch {
      setBanners([]);
    } finally {
      setLoaded(true);
    }
  }, [placement]);

  useEffect(() => {
    void load();
  }, [load]);

  const content = (
    <div className={cn(embedded ? "space-y-3" : "flex-1 overflow-y-auto p-2 space-y-3 patent-frame-scroll", className)}>
      {!loaded && <div className="h-24 rounded-lg bg-slate-200/60 animate-pulse" />}
      {loaded && banners.length === 0 && (
        <p className="text-[10px] text-slate-400 text-center py-6 px-1 leading-relaxed">
          등록된 배너가 없습니다.
        </p>
      )}
      {banners.map((b) => {
        const inner = (
          <div className="group rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-amber-200 transition-all">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.imageUrl}
              alt={b.title || "광고 배너"}
              className="w-full aspect-[4/5] object-cover bg-slate-100"
              loading="lazy"
            />
            {b.title && (
              <div className="px-2 py-1.5 text-[10px] text-slate-600 line-clamp-2 flex items-start gap-1">
                {b.linkUrl && <ExternalLink size={10} className="shrink-0 mt-0.5 text-amber-600" />}
                {b.title}
              </div>
            )}
          </div>
        );
        if (b.linkUrl) {
          return (
            <a key={b.id} href={b.linkUrl} target="_blank" rel="noopener noreferrer sponsored" className="block">
              {inner}
            </a>
          );
        }
        return <div key={b.id}>{inner}</div>;
      })}
    </div>
  );

  if (embedded) return content;

  return (
    <aside
      className={cn(
        "w-44 shrink-0 border-l border-slate-200 bg-slate-50/80 flex flex-col overflow-hidden hidden xl:flex",
        className
      )}
    >
      <div className="px-2.5 py-2 border-b border-slate-200 bg-white flex items-center gap-1.5">
        <Megaphone size={12} className="text-amber-600" />
        <h3 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">광고</h3>
      </div>
      {content}
    </aside>
  );
}
