"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Calendar,
  CreditCard,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LayoutList,
  MessageCircle,
  MessageSquare,
  Send,
  Settings,
  UserCircle,
  Users,
} from "lucide-react";

const MODULES = [
  { icon: LayoutDashboard, name: "업무 대시보드", desc: "공지·기일·담당사건·결재 한 화면" },
  { icon: FolderOpen, name: "사건 관리", desc: "등록·목록·상세·수정·메모·자료실" },
  { icon: LayoutList, name: "게시판", desc: "공지사항·판례·내부 게시" },
  { icon: Calendar, name: "기일 달력", desc: "월간·주간 일정·팝업 관리" },
  { icon: MessageSquare, name: "상담관리", desc: "상담 이력·회의실 연동" },
  { icon: UserCircle, name: "고객관리", desc: "의뢰인·엑셀 import preview" },
  { icon: Send, name: "메신저", desc: "외부·의뢰인 커뮤니케이션" },
  { icon: MessageCircle, name: "사내 메신저", desc: "팀 내부 실시간 소통" },
  { icon: FileText, name: "전자결재", desc: "기안·다단계 결재·이력" },
  { icon: CreditCard, name: "회계/수납", desc: "수임료·미수금 관리" },
  { icon: BarChart3, name: "통계/분석", desc: "사건·업무 리포트" },
  { icon: Users, name: "직원 관리", desc: "조직·권한·담당배정" },
  { icon: Bell, name: "알림 설정", desc: "기일·결재 알림" },
  { icon: Settings, name: "시스템 설정", desc: "메뉴·환경·AI 설정" },
];

export function WwwModuleGrid() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-primary-600">ALL-IN-ONE PLATFORM</p>
          <h2 className="mt-3 text-3xl font-bold text-[#0A1628] sm:text-4xl">
            하나의 플랫폼에서
            <br className="sm:hidden" /> 송무 업무 전체
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            LawTop GL 모듈과 대응되는 15개 이상 업무 화면을 LawyGo 하나로 통합합니다.
          </p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MODULES.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 4) * 0.05 }}
              className="group rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 p-5 transition-all hover:border-primary-200 hover:shadow-lg"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                <m.icon size={18} />
              </div>
              <h3 className="mt-4 font-bold text-slate-900">{m.name}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
