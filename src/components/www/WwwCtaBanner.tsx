import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function WwwCtaBanner() {
  return (
    <section className="relative overflow-hidden bg-[#0A1628] py-20 text-white sm:py-24">
      <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold sm:text-4xl">송무 관리, LawyGo가 대신 챙깁니다</h2>
        <p className="mt-4 text-slate-300">
          10초 만에 가입하고, 분산된 사건·기일·결재 업무에서 벗어나세요.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/login/signup"
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-sky-50"
          >
            LawyGo 무료로 시작하기
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/www/pricing"
            className="inline-flex rounded-full border border-white/25 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            요금제 비교
          </Link>
        </div>
      </div>
    </section>
  );
}
