import Link from "next/link";
import { Scale } from "lucide-react";

export function WwwFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/www" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A1628] text-white">
                <Scale size={15} />
              </span>
              <span className="font-bold text-[#0A1628]">LawyGo</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
              LawyGo는 로펌·법무팀을 위한 송무관리 프로그램입니다. 사건·기일·결재·고객·엑셀 연동을 하나의 플랫폼에서 제공합니다.
            </p>
            <p className="mt-4 text-xs text-slate-400">
              LawyGo는 법률사무 처리나 법률 자문을 대행하지 않습니다. 구체적인 사안은 변호사 등 법률 전문가의 조언을 받으시기 바랍니다.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">제품</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li><Link href="/www#product-core" className="hover:text-slate-900">LawyGo Core</Link></li>
              <li><Link href="/www#product-professional" className="hover:text-slate-900">Professional</Link></li>
              <li><Link href="/www#product-enterprise" className="hover:text-slate-900">Enterprise</Link></li>
              <li><Link href="/www/pricing" className="hover:text-slate-900">가격</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">시작하기</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li><Link href="/login" className="hover:text-slate-900">로그인</Link></li>
              <li><Link href="/login/signup" className="hover:text-slate-900">회원가입</Link></li>
              <li><Link href="/www#security" className="hover:text-slate-900">보안</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-slate-100 pt-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} LawyGo. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
