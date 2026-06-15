const LOGOS = ["법무법인 A", "로펌 B", "기업 법무 C", "전문 로펌 D", "파트너 E", "고객 F"];

export function WwwTrustBar() {
  return (
    <section className="border-y border-slate-100 bg-slate-50/50 py-12">
      <p className="text-center text-sm font-medium text-slate-500">다수의 로펌 · 법무팀이 선택한 LawyGo</p>
      <div className="mx-auto mt-8 flex max-w-5xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-6">
        {LOGOS.map((name) => (
          <span
            key={name}
            className="text-sm font-bold tracking-wide text-slate-300 transition-colors hover:text-slate-400"
          >
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}
