/**
 * 체험판(관리번호 10000) — 기능별 샘플 1건
 * DB 시드와 UI mock fallback을 동일 키로 유지
 */

import type {
  CaseItem,
  ConsultationItem,
  ConsultationRoom,
  StaffMember,
  Notification,
  FinanceEntry,
  BankTransaction,
  DashboardStats,
} from "./types";

const today = new Date();
const addDays = (d: number) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split("T")[0];
};

/** 체험 샘플 사건번호 (DB unique) */
export const TRIAL_CASE_NUMBER = "2026가합10000";

export const trialSampleCase: CaseItem = {
  id: "trial-case-1",
  caseNumber: TRIAL_CASE_NUMBER,
  caseType: "민사",
  caseName: "손해배상(체험)",
  court: "서울중앙지방법원",
  clientName: "체험 의뢰인",
  clientPosition: "원고",
  opponentName: "상대방",
  status: "진행중",
  assignedStaff: "신강",
  assistants: "",
  nextDate: addDays(7),
  nextDateType: "변론기일",
  isElectronic: true,
  isUrgent: false,
  isImmutable: false,
  receivedDate: addDays(-30),
  amount: 3000000,
  receivedAmount: 1500000,
  pendingAmount: 1500000,
  notes: "체험판 샘플 사건입니다.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const trialSampleCases: CaseItem[] = [trialSampleCase];

export const trialSampleStaff: StaffMember[] = [
  {
    id: "trial-staff-1",
    name: "신강",
    role: "관리자",
    department: "체험",
    email: "trial@lawygo.app",
    phone: "010-0000-1000",
    level: 5,
    loginId: "trial-admin",
  },
];

export const trialSampleConsultationRooms: ConsultationRoom[] = [
  { id: "trial-room-1", name: "체험 상담실", sortOrder: 1, remarks: "체험판 샘플" },
];

export const trialSampleConsultations: ConsultationItem[] = [
  {
    id: "trial-con-1",
    consultationDate: addDays(3),
    startTime: "14:00",
    endTime: "14:30",
    roomId: "trial-room-1",
    roomName: "체험 상담실",
    consultantId: "trial-staff-1",
    consultantName: "신강",
    clientName: "체험 의뢰인",
    purpose: "신규 상담(체험)",
    importance: "medium",
    status: "scheduled",
    caseId: "trial-case-1",
    caseNumber: TRIAL_CASE_NUMBER,
    notes: "체험판 샘플 상담 1건",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const trialSampleNotifications: Notification[] = [
  {
    id: "trial-n1",
    type: "urgent_date",
    title: "다가오는 기일 — 체험 사건",
    message: `${TRIAL_CASE_NUMBER} 변론기일이 ${trialSampleCase.nextDate}입니다.`,
    isRead: false,
    caseId: "trial-case-1",
    createdAt: new Date().toISOString(),
    link: "/cases",
  },
];

export const trialSampleFinanceEntries: FinanceEntry[] = [
  {
    id: "trial-fe1",
    type: "미수금",
    caseId: "trial-case-1",
    caseNumber: TRIAL_CASE_NUMBER,
    clientName: "체험 의뢰인",
    amount: 1500000,
    date: addDays(-7),
    description: "체험 착수금 잔액",
    status: "미확인",
  },
];

export const trialSampleBankTransactions: BankTransaction[] = [
  {
    id: "trial-bt1",
    date: addDays(-14),
    depositorName: "체험 의뢰인",
    amount: 1500000,
    bankName: "국민은행",
    memo: "체험 착수금",
    matchedTo: undefined,
  },
];

export const trialSampleDashboardStats: DashboardStats = {
  todayDeadlines: 0,
  urgentCases: 0,
  pendingApprovals: 0,
  pendingPayments: 1,
  totalActiveCases: 1,
  totalMonthlyIncome: 1500000,
};
