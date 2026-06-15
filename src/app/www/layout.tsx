import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LawyGo — 송무관리 프로그램",
  description:
    "로펌·법무팀을 위한 송무관리 시스템. 사건·기일·결재·고객·엑셀 연동을 하나의 플랫폼에서.",
};

export default function WwwLayout({ children }: { children: React.ReactNode }) {
  return <div className="www-site min-h-screen bg-white text-slate-900 antialiased">{children}</div>;
}
