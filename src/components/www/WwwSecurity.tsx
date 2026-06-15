import Link from "next/link";
import { ArrowRight, Lock, Server, Shield } from "lucide-react";
import { WWW_SECURITY } from "@/lib/wwwContent";

const ICONS = [Shield, Lock, Server];

export function WwwSecurity() {
  return (
    <section id="security" className="bg-slate-50/80 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-primary-600">SECURITY</p>
          <h2 className="mt-3 text-3xl font-bold text-[#0A1628]">기술과 보안</h2>
          <p className="mx-auto mt-4 max-w-lg text-slate-600">
            송무 데이터는 신뢰가 전부입니다. 인증·권한·인프라를 분리해 보호합니다.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {WWW_SECURITY.map((item, i) => {
            const Icon = ICONS[i] ?? Shield;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                  <Icon size={22} />
                </div>
                <h3 className="mt-4 font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <Link href="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800">
            프로그램 로그인 <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
