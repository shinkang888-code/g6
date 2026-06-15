import type { CaseItem, StaffMember, Timeline, Notification, BankTransaction, FinanceEntry, ApprovalDoc, DashboardStats, ConsultationItem, ConsultationRoom } from "./types";

/** 데모용 직원 50건 생성 (직원관리 페이지 테스트용) */
function generateDemoStaff(): StaffMember[] {
  const roles: StaffMember["role"][] = ["임원", "변호사", "변호사", "변호사", "사무장", "국장", "직원", "사무원", "사무원", "인턴"];
  const departments = ["형사부", "민사부", "행정팀", "지적재산권팀", "세무법인팀", "국제법무팀", "기업법무팀", "노동법팀", "가사부", "파산팀"];
  const jobTitles: (StaffMember["jobTitle"])[] = ["부장", "팀장", "과장", "대리", "주임", "인턴"];
  const surnames = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"];
  const givenNames = ["민준", "서연", "지훈", "수아", "도윤", "하은", "시우", "지유", "준호", "예진", "성민", "유나", "현우", "소희", "재현", "미래", "태현", "다은", "승민", "지아", "영호", "수진", "동현", "서현", "민서"];
  const list: StaffMember[] = [];
  for (let i = 1; i <= 50; i++) {
    const role = roles[i % roles.length];
    const level = role === "임원" ? 5 : role === "변호사" ? 3 + (i % 2) : role === "사무장" || role === "국장" ? 2 : role === "인턴" ? 0 : 1;
    const name = surnames[i % surnames.length] + givenNames[i % givenNames.length];
    list.push({
      id: `demo-staff-${i}`,
      name,
      role,
      department: departments[i % departments.length],
      email: `staff${i}@lawfirm.com`,
      phone: `010-${String(1000 + i).padStart(4, "0")}-${String(5000 + i).padStart(4, "0")}`,
      level,
      jobTitle: role === "인턴" ? "인턴" : jobTitles[i % (jobTitles.length - 1)],
      loginId: `staff${i}`,
    });
  }
  return list;
}

/** 더미 직원용 공통 테스트 비밀번호 (회원관리에서 동일 비밀번호로 등록 시 직원·회원 계정 일치) */
export const DEMO_STAFF_PASSWORD = "lawygo123";

const baseStaff: StaffMember[] = [
  { id: "s1", name: "김민준", role: "변호사", department: "형사부", email: "minjun@lawfirm.com", phone: "010-1234-5678", level: 4, loginId: "minjun" },
  { id: "s2", name: "이서연", role: "변호사", department: "민사부", email: "seoyeon@lawfirm.com", phone: "010-2345-6789", level: 3, loginId: "seoyeon" },
  { id: "s3", name: "박지훈", role: "사무장", department: "행정팀", email: "jihoon@lawfirm.com", phone: "010-3456-7890", level: 2, loginId: "jihoon" },
  { id: "s4", name: "최연진", role: "사무원", department: "형사부", email: "yeonjin@lawfirm.com", phone: "010-4567-8901", level: 1, loginId: "yeonjin" },
  { id: "s5", name: "정수경", role: "사무원", department: "민사부", email: "sukyung@lawfirm.com", phone: "010-5678-9012", level: 1, loginId: "sukyung" },
  { id: "s6", name: "강이소", role: "인턴", department: "형사부", email: "iso@lawfirm.com", phone: "010-6789-0123", level: 0, loginId: "iso" },
];

export const mockStaff: StaffMember[] = [...baseStaff, ...generateDemoStaff()];

const today = new Date();
const addDays = (d: number) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split("T")[0];
};

/** 데모용 사건 100건 생성 (사건관리 페이지 다수 목록·페이지네이션 테스트용) */
function generateDemoCases(): CaseItem[] {
  const courts = ["서울중앙지방법원", "서울고등법원", "수원지방법원", "인천지방법원", "대전지방법원", "부산지방법원", "광주지방법원", "대구지방법원", "서울동부지방법원", "서울남부지방법원", "수원고등법원", "검찰청", "경찰서"];
  const caseTypes = ["형사", "민사", "행정", "가사", "파산"];
  const caseNames = ["손해배상", "특수상해", "사기", "명예훼손", "임금청구", "부동산가처분", "대여금반환", "계약해제", "손해배상청구", "의료과실", "교통사고", "산업재해", "해고무효", "부당해고", "퇴직금청구", "임대차분쟁", "건물명도", "소유권이전", "상속분쟁", "이혼"];
  const clients = ["김철수", "이영희", "박민수", "최지현", "정대호", "강미라", "조성훈", "윤서아", "한동훈", "오세훈", "주식회사 A", "주식회사 B", "(유)테크원", "개인 C", "D건설", "E금융", "F보험", "G물류", "H제약", "I전자"];
  const positions = ["원고", "피고", "피고인", "청구인", "피청구인", "채권자", "채무자"];
  const staff = ["김민준", "이서연", "박지훈"];
  const statuses: CaseItem["status"][] = ["진행중", "진행중", "진행중", "종결", "사임"];
  const dateTypes = ["선고기일", "변론기일", "심문기일", "공판기일", "진술기일", "제출기일"];
  const list: CaseItem[] = [];
  for (let i = 1; i <= 100; i++) {
    const year = 2024 + (i % 3);
    const num = String(1000 + i).padStart(4, "0");
    const caseType = caseTypes[i % caseTypes.length];
    const court = courts[i % courts.length];
    const client = clients[i % clients.length];
    const status = statuses[i % statuses.length];
    const nextOffset = status === "종결" || status === "사임" ? 0 : (i % 30) + 1;
    const iso = `${year}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`;
    list.push({
      id: `demo-${i}`,
      caseNumber: `${year}${caseType === "형사" ? "노" : "가합"}${num}`,
      caseType,
      caseName: caseNames[i % caseNames.length] + (i > 20 ? ` (${i})` : ""),
      court,
      clientName: client,
      clientPosition: positions[i % positions.length],
      opponentName: "상대방",
      status,
      assignedStaff: staff[i % staff.length],
      assistants: i % 3 === 0 ? "정수경" : i % 3 === 1 ? "최연진, 정수경" : "강이소",
      nextDate: status === "종결" || status === "사임" ? null : addDays(nextOffset),
      nextDateType: status === "종결" || status === "사임" ? "" : dateTypes[i % dateTypes.length],
      isElectronic: i % 3 === 0,
      isUrgent: i % 5 === 0,
      isImmutable: i % 7 === 0,
      receivedDate: iso,
      amount: (i % 10 + 1) * 1000000,
      receivedAmount: Math.floor((i % 10 + 1) * 1000000 * 0.6),
      pendingAmount: Math.floor((i % 10 + 1) * 1000000 * 0.4),
      notes: `데모 사건 ${i}`,
      createdAt: `${iso}T09:00:00Z`,
      updatedAt: new Date().toISOString(),
    });
  }
  return list;
}

const baseCases: CaseItem[] = [
  {
    id: "c001",
    caseNumber: "2026노107",
    caseType: "형사",
    caseName: "특수상해",
    court: "서울고등법원",
    clientName: "이창우",
    clientPosition: "피고인",
    opponentName: "검사",
    status: "진행중",
    assignedStaff: "김민준",
    assistants: "최연진, 정수경, 강이소",
    nextDate: addDays(0),
    nextDateType: "선고기일",
    isElectronic: true,
    isUrgent: true,
    isImmutable: true,
    receivedDate: "2026-01-15",
    amount: 5000000,
    receivedAmount: 3000000,
    pendingAmount: 2000000,
    notes: "항소심 진행중. 증거 보강 필요.",
    createdAt: "2026-01-15T09:00:00Z",
    updatedAt: "2026-03-04T14:30:00Z",
  },
  {
    id: "c002",
    caseNumber: "2025가합3421",
    caseType: "민사",
    caseName: "손해배상청구",
    court: "서울중앙지방법원",
    clientName: "주식회사 테크원",
    clientPosition: "원고",
    opponentName: "홍길동",
    status: "진행중",
    assignedStaff: "이서연",
    assistants: "정수경",
    nextDate: addDays(2),
    nextDateType: "변론기일",
    isElectronic: true,
    isUrgent: true,
    isImmutable: false,
    receivedDate: "2025-08-10",
    amount: 10000000,
    receivedAmount: 5000000,
    pendingAmount: 5000000,
    notes: "계약서 원본 제출 필요.",
    createdAt: "2025-08-10T10:00:00Z",
    updatedAt: "2026-03-03T11:20:00Z",
  },
  {
    id: "c003",
    caseNumber: "2026카기551",
    caseType: "민사",
    caseName: "부동산가처분",
    court: "인천지방법원",
    clientName: "박성철",
    clientPosition: "채권자",
    opponentName: "김영호",
    status: "진행중",
    assignedStaff: "이서연",
    assistants: "정수경, 강이소",
    nextDate: addDays(3),
    nextDateType: "심문기일",
    isElectronic: false,
    isUrgent: true,
    isImmutable: false,
    receivedDate: "2026-02-20",
    amount: 3000000,
    receivedAmount: 3000000,
    pendingAmount: 0,
    notes: "가처분 인용 결정 예상.",
    createdAt: "2026-02-20T09:30:00Z",
    updatedAt: "2026-03-02T16:45:00Z",
  },
  {
    id: "c004",
    caseNumber: "2025고단8821",
    caseType: "형사",
    caseName: "사기",
    court: "수원지방법원",
    clientName: "최민서",
    clientPosition: "피고인",
    opponentName: "검사",
    status: "진행중",
    assignedStaff: "김민준",
    assistants: "최연진",
    nextDate: addDays(7),
    nextDateType: "공판기일",
    isElectronic: true,
    isUrgent: false,
    isImmutable: false,
    receivedDate: "2025-11-05",
    amount: 8000000,
    receivedAmount: 8000000,
    pendingAmount: 0,
    notes: "증인 신청서 준비 완료.",
    createdAt: "2025-11-05T14:00:00Z",
    updatedAt: "2026-02-28T09:10:00Z",
  },
  {
    id: "c005",
    caseNumber: "2026나12045",
    caseType: "민사",
    caseName: "임금청구",
    court: "서울동부지방법원",
    clientName: "노동조합 연대",
    clientPosition: "원고",
    opponentName: "주식회사 한국물류",
    status: "진행중",
    assignedStaff: "이서연",
    assistants: "정수경",
    nextDate: addDays(10),
    nextDateType: "변론기일",
    isElectronic: false,
    isUrgent: false,
    isImmutable: false,
    receivedDate: "2026-01-08",
    amount: 15000000,
    receivedAmount: 7500000,
    pendingAmount: 7500000,
    notes: "집단소송. 원고 30명.",
    createdAt: "2026-01-08T11:00:00Z",
    updatedAt: "2026-03-01T13:00:00Z",
  },
  {
    id: "c006",
    caseNumber: "2025헌마422",
    caseType: "헌법",
    caseName: "위헌법률심판",
    court: "헌법재판소",
    clientName: "시민단체 정의연대",
    clientPosition: "청구인",
    opponentName: "국가",
    status: "종결",
    assignedStaff: "김민준",
    assistants: "강이소",
    nextDate: addDays(30),
    nextDateType: "공개변론",
    isElectronic: true,
    isUrgent: false,
    isImmutable: false,
    receivedDate: "2025-09-15",
    amount: 20000000,
    receivedAmount: 10000000,
    pendingAmount: 10000000,
    notes: "보충서면 제출 예정.",
    createdAt: "2025-09-15T10:00:00Z",
    updatedAt: "2026-02-20T10:00:00Z",
  },
  {
    id: "c007",
    caseNumber: "2025가소12304",
    caseType: "민사",
    caseName: "대여금반환청구",
    court: "서울남부지방법원",
    clientName: "황지수",
    clientPosition: "원고",
    opponentName: "김대현",
    status: "종결",
    assignedStaff: "이서연",
    assistants: "정수경",
    nextDate: null,
    nextDateType: "",
    isElectronic: false,
    isUrgent: false,
    isImmutable: false,
    receivedDate: "2025-06-01",
    amount: 2000000,
    receivedAmount: 2000000,
    pendingAmount: 0,
    notes: "승소 확정 판결.",
    createdAt: "2025-06-01T09:00:00Z",
    updatedAt: "2026-01-15T16:00:00Z",
  },
  {
    id: "c008",
    caseNumber: "2026초기112",
    caseType: "형사",
    caseName: "명예훼손",
    court: "서울중앙지방법원",
    clientName: "유명인 A씨",
    clientPosition: "고소인",
    opponentName: "블로거 B씨",
    status: "진행중",
    assignedStaff: "김민준",
    assistants: "최연진, 강이소",
    nextDate: addDays(14),
    nextDateType: "진술기일",
    isElectronic: true,
    isUrgent: false,
    isImmutable: false,
    receivedDate: "2026-02-10",
    amount: 5000000,
    receivedAmount: 2500000,
    pendingAmount: 2500000,
    notes: "증거자료 스크린샷 수집 완료.",
    createdAt: "2026-02-10T10:30:00Z",
    updatedAt: "2026-03-04T09:00:00Z",
  },
];

export const mockCases: CaseItem[] = [...baseCases, ...generateDemoCases()];

export const mockTimeline: Timeline[] = [
  {
    id: "t1",
    caseId: "c001",
    type: "memo",
    title: "의뢰인 상담 메모",
    content: "의뢰인 이창우 씨 오늘 오전 방문. 항소 이유서 보충 자료 추가 제출하기로 함. 피해자와 합의 가능성 타진 중.",
    authorId: "s1",
    authorName: "김민준",
    date: "2026-03-04T14:30:00Z",
  },
  {
    id: "t2",
    caseId: "c001",
    type: "court_update",
    title: "서울고등법원 - 기일 통지",
    content: "선고기일이 2026-03-05로 지정됨. 오전 10시 제11형사부.",
    authorId: "system",
    authorName: "법원 시스템",
    date: "2026-03-01T09:00:00Z",
  },
  {
    id: "t3",
    caseId: "c001",
    type: "document",
    title: "항소이유서 최종본 업로드",
    content: "2026년 3월 제출용 항소이유서 최종 버전 업로드 완료.",
    authorId: "s4",
    authorName: "최연진",
    date: "2026-02-28T16:45:00Z",
    attachments: [
      { id: "f1", fileName: "항소이유서_최종_20260228.pdf", fileSize: 1048576, mimeType: "application/pdf", url: "#" },
      { id: "f2", fileName: "증거자료_목록.xlsx", fileSize: 15360, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", url: "#" },
    ],
  },
  {
    id: "t4",
    caseId: "c001",
    type: "finance",
    title: "수임료 수납",
    content: "2차 수임료 1,000,000원 수납 완료.",
    authorId: "s3",
    authorName: "박지훈",
    date: "2026-02-15T10:00:00Z",
    metadata: { amount: 1000000, type: "수납" },
  },
  {
    id: "t5",
    caseId: "c001",
    type: "status_change",
    title: "상태 변경: 1심 종결 → 항소심 진행",
    content: "1심 징역 2년 판결 후 항소 제기. 항소심 진행 상태로 변경됨.",
    authorId: "s1",
    authorName: "김민준",
    date: "2026-01-20T11:30:00Z",
  },
];

export const mockNotifications: Notification[] = [
  {
    id: "n1",
    type: "urgent_date",
    title: "오늘 선고기일 - 이창우 사건",
    message: "2026노107 특수상해 사건 오전 10시 서울고등법원 제11형사부",
    isRead: false,
    caseId: "c001",
    createdAt: new Date().toISOString(),
    link: "/cases/c001",
  },
  {
    id: "n2",
    type: "approval_request",
    title: "결재 요청 - 손해배상청구 보고서",
    message: "이서연 변호사가 결재를 요청했습니다.",
    isRead: false,
    caseId: "c002",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    link: "/approval",
  },
  {
    id: "n3",
    type: "finance",
    title: "미수금 알림 - 테크원 사건",
    message: "2025가합3421 사건 미수금 5,000,000원이 30일 경과했습니다.",
    isRead: true,
    caseId: "c002",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    link: "/finance",
  },
];

export const mockBankTransactions: BankTransaction[] = [
  { id: "bt1", date: addDays(-1), depositorName: "이창우", amount: 1000000, bankName: "국민은행", memo: "수임료 2차", matchedTo: undefined },
  { id: "bt2", date: addDays(-2), depositorName: "테크원", amount: 2000000, bankName: "신한은행", memo: "손해배상건", matchedTo: undefined },
  { id: "bt3", date: addDays(-3), depositorName: "박성철", amount: 500000, bankName: "우리은행", memo: "가처분", matchedTo: undefined },
  { id: "bt4", date: addDays(-1), depositorName: "노동조합연대", amount: 3000000, bankName: "기업은행", memo: "임금청구 착수금", matchedTo: undefined },
];

export const mockFinanceEntries: FinanceEntry[] = [
  { id: "fe1", type: "미수금", caseId: "c001", caseNumber: "2026노107", clientName: "이창우", amount: 2000000, date: "2026-02-01", description: "잔여 수임료", status: "미확인" },
  { id: "fe2", type: "미수금", caseId: "c002", caseNumber: "2025가합3421", clientName: "주식회사 테크원", amount: 5000000, date: "2026-01-15", description: "2차 착수금", status: "미확인" },
  { id: "fe3", type: "미수금", caseId: "c005", caseNumber: "2026나12045", clientName: "노동조합 연대", amount: 7500000, date: "2026-02-08", description: "착수금 잔액", status: "미확인" },
  { id: "fe4", type: "수납", caseId: "c004", caseNumber: "2025고단8821", clientName: "최민서", amount: 8000000, date: "2025-11-10", description: "전액 수납", status: "확인" },
];

/** 결재 문서 더미 40건 생성 */
function generateMockApprovals(): ApprovalDoc[] {
  const requesters = [
    { id: "s1", name: "김민준" },
    { id: "s2", name: "이서연" },
    { id: "s3", name: "박지훈" },
    { id: "s4", name: "최연진" },
  ];
  const types: ApprovalDoc["type"][] = ["청구서", "보고서", "위임장", "계약서", "기타"];
  const statuses: ApprovalDoc["status"][] = ["결재요청", "결재요청", "결재중", "결재완료", "결재완료", "결재완료", "반려"];
  const casePrefixes = ["2024가합", "2024노", "2025가합", "2025고단", "2025나", "2026가합", "2026노", "2026고단"];
  const titleSuffixes = [
    "착수금 청구서", "2차 착수금 청구서", "잔여 수임료 청구서", "변호인 선임동의서", "수임계약서",
    "비밀유지각서", "의견서", "준비서면", "월례 보고서", "사건 진행 보고서", "위임장", "소송위임장",
    "손해배상 청구서", "임금청구 청구서", "의료비 청구서", "정산 보고서", "결산 보고서",
  ];
  const caseNames = ["손해배상", "특수상해", "사기", "임금청구", "명예훼손", "부동산", "이혼", "상속", "파산", "노동"];

  const list: ApprovalDoc[] = [];
  const dayMs = 86400000;

  for (let i = 1; i <= 40; i++) {
    const req = requesters[i % requesters.length];
    const prefix = casePrefixes[i % casePrefixes.length];
    const num = String(1000 + i).padStart(4, "0");
    const caseNumber = `${prefix}${num}`;
    const caseName = caseNames[i % caseNames.length];
    const suffix = titleSuffixes[i % titleSuffixes.length];
    const status = statuses[i % statuses.length];
    const createdAt = new Date(Date.now() - dayMs * (40 - i + 1)).toISOString();
    const completedAt =
      status === "결재완료" || status === "반려"
        ? new Date(Date.now() - dayMs * (40 - i)).toISOString()
        : undefined;

    const step1Signed = status !== "결재요청";
    const step2Signed = status === "결재완료" || status === "반려";

    list.push({
      id: `ap-${i}`,
      title: `${caseNumber} ${caseName} ${suffix}`,
      type: types[i % types.length],
      status,
      caseId: `c${String(i).padStart(3, "0")}`,
      caseNumber,
      requesterId: req.id,
      requesterName: req.name,
      amount: types[i % types.length] === "청구서" ? (i % 3 === 0 ? 5000000 : 3000000) : undefined,
      approvalLine: [
        {
          order: 1,
          staffId: "s3",
          staffName: "박지훈",
          role: "사무장",
          status: step1Signed ? (status === "반려" ? "반려" : "승인") : "대기",
          signedAt: step1Signed ? completedAt : undefined,
        },
        {
          order: 2,
          staffId: "s1",
          staffName: "김민준",
          role: "대표변호사",
          status: step2Signed ? (status === "반려" ? "반려" : "승인") : "대기",
          signedAt: step2Signed ? completedAt : undefined,
        },
      ],
      createdAt,
      completedAt,
      notes: i % 4 === 0 ? "검토 부탁드립니다." : undefined,
      attachmentNames: i % 3 === 0 ? ["첨부.pdf"] : undefined,
    });
  }

  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// 전자결재 더미데이터는 실제 사용 시 혼동을 줄이기 위해 기본값을 비워 둔다.
// 필요 시 API 연동 또는 별도 시드에서 주입한다.
export const mockApprovals: ApprovalDoc[] = [];

export const mockDashboardStats: DashboardStats = {
  todayDeadlines: 1,
  urgentCases: 3,
  pendingApprovals: 2,
  pendingPayments: 3,
  totalActiveCases: 6,
  totalMonthlyIncome: 12500000,
};

/** 상담실 (회의실 등록/편집에 대응) */
export const mockConsultationRooms: ConsultationRoom[] = [
  { id: "r1", name: "902호(대회의실)", sortOrder: 1, remarks: "대형 상담" },
  { id: "r2", name: "1005호(소회의실)", sortOrder: 2, remarks: "1:1 상담" },
  { id: "r3", name: "1007호(중회의실)", sortOrder: 3 },
  { id: "r4", name: "1307호(소회의실)", sortOrder: 4 },
];

/** 상담 일정·기록 더미 20건 (캘린더 연동, 매치사건 연동) */
const consultationRooms: { id: string; name: string }[] = [
  { id: "r1", name: "902호(대회의실)" },
  { id: "r2", name: "1005호(소회의실)" },
  { id: "r3", name: "1007호(중회의실)" },
  { id: "r4", name: "1307호(소회의실)" },
];
const consultationConsultants: { id: string; name: string }[] = [
  { id: "s1", name: "김민준" },
  { id: "s2", name: "이서연" },
  { id: "s3", name: "박지훈" },
  { id: "s4", name: "최연진" },
  { id: "s5", name: "정수경" },
  { id: "s6", name: "강이소" },
];
const consultationClients = [
  "이창우", "주식회사 테크원", "홍길동", "박성철", "노동조합연대", "김대표", "이의뢰인",
  "정민수", "한지원", "윤서준", "㈜글로벌솔루션", "조은희", "송민호", "홍지훈", "오수빈",
];
const consultationPurposes = [
  "형사 사건 상담", "민사 상담", "신규 상담", "선고기일 전 상담", "손해배상 상담",
  "노동 분쟁 상담", "계약 검토 상담", "소송 전략 회의", "증거 검토", "초회 상담",
  "후속 상담", "합의 협의", "의견 청취", "자문 요청", "계약서 검토",
];
const statuses: Array<"scheduled" | "notified" | "completed" | "cancelled"> = ["scheduled", "notified", "completed", "cancelled"];
const importanceLevels: Array<"high" | "medium" | "low"> = ["high", "medium", "low"];
const timeSlots = [
  ["09:00", "09:30"], ["09:30", "10:00"], ["10:00", "10:30"], ["11:00", "11:30"],
  ["14:00", "14:30"], ["14:30", "15:00"], ["15:00", "15:30"], ["16:00", "16:30"],
];

function buildMockConsultations(): ConsultationItem[] {
  const now = new Date().toISOString();
  const items: ConsultationItem[] = [];
  for (let i = 1; i <= 20; i++) {
    const day = (i - 1) % 14;
    const slot = timeSlots[(i - 1) % timeSlots.length];
    const room = consultationRooms[(i - 1) % consultationRooms.length];
    const consultant = consultationConsultants[(i - 1) % consultationConsultants.length];
    items.push({
      id: `con${i}`,
      consultationDate: addDays(day),
      startTime: slot[0],
      endTime: slot[1],
      roomId: room.id,
      roomName: room.name,
      consultantId: consultant.id,
      consultantName: consultant.name,
      clientName: consultationClients[(i - 1) % consultationClients.length],
      purpose: consultationPurposes[(i - 1) % consultationPurposes.length],
      importance: importanceLevels[(i - 1) % importanceLevels.length],
      status: statuses[(i - 1) % statuses.length],
      caseId: i % 4 === 0 ? `c00${(i % 3) + 1}` : undefined,
      caseNumber: i % 4 === 0 ? (i % 2 === 0 ? "2026노107" : "2025가합3421") : undefined,
      notes: i % 3 === 0 ? "비고 메모" : undefined,
      createdAt: now,
      updatedAt: now,
    });
  }
  return items;
}

export const mockConsultations: ConsultationItem[] = buildMockConsultations();
