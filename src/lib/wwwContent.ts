export type WwwProductId = "core" | "professional" | "enterprise";

export const WWW_PRODUCTS: {
  id: WwwProductId;
  name: string;
  tagline: string;
  description: string;
  bullets: string[];
  cta: string;
  ctaHref: string;
  badge?: string;
}[] = [
  {
    id: "core",
    name: "LawyGo Core",
    tagline: "송무 운영의 시작",
    description: "소형 로펌·1인 사무소를 위한 핵심 송무관리. 사건·기일·고객을 한곳에서.",
    bullets: [
      "사건 등록·목록·상세·메모·자료실",
      "기일 달력 & D-Day 대시보드",
      "LawTop형 엑셀 가져오기·보내기",
      "공지 게시판 & 업무 대시보드",
    ],
    cta: "Core 무료 체험",
    ctaHref: "/login/signup",
    badge: "추천",
  },
  {
    id: "professional",
    name: "LawyGo Professional",
    tagline: "팀 협업 송무 허브",
    description: "담당자·결재·메신저·수납까지 이어지는 로펌 표준 워크플로우.",
    bullets: [
      "다단계 전자결재 & 결재선 이력",
      "사내·외부 메신저 & 상담관리",
      "회계/수납·통계/분석",
      "담당변경 일괄처리·권한별 메뉴",
    ],
    cta: "Professional 시작",
    ctaHref: "/login/signup",
  },
  {
    id: "enterprise",
    name: "LawyGo Enterprise",
    tagline: "기업·그룹 법무 플랫폼",
    description: "조직·결재·연동·보안을 기업 환경에 맞게 구축하는 송무관리 솔루션.",
    bullets: [
      "SSO · 조직/권한 · 감사 로그",
      "맞춤 결재라인 & 워크플로우",
      "법원 사건 동기화 · 전용 클라우드",
      "전담 도입·운영 지원",
    ],
    cta: "도입 문의",
    ctaHref: "/login",
    badge: "맞춤 견적",
  },
];

export const WWW_FEATURE_BLOCKS = [
  {
    id: "cases",
    tag: "CASE MANAGEMENT",
    title: "수백 건의 사건도\n한눈에 정렬·검색·관리",
    description:
      "사건번호, 의뢰인, 담당자, 진행상태를 한 화면에서 관리합니다. LawTop GL형 엑셀로 기존 데이터를 그대로 가져오고, 수정·보내기까지 round-trip 합니다.",
    points: [
      { title: "사건 목록·상세·수정 탭", desc: "의뢰인 클릭 시 사건수정, 사건명 클릭 시 메모·자료실" },
      { title: "엑셀 import 미리보기", desc: "일괄 등록 전 데이터 검증으로 실수 방지" },
      { title: "법원 사건 동기화", desc: "대법원 포털 연동으로 사건 정보 자동 반영" },
      { title: "메모·자료실 통합", desc: "사건별 기록과 파일을 분산 저장 없이 관리" },
    ],
    reverse: false,
  },
  {
    id: "deadline",
    tag: "DEADLINE TRACKING",
    title: "기일·불변기한을\n놓치지 않게 추적합니다",
    description:
      "다음 기일, D-Day, 불변기한을 자동 집계합니다. 오늘·3일·7일 카드와 기일 달력으로 송무팀 전체가 같은 일정을 봅니다.",
    points: [
      { title: "업무 대시보드 기일 카드", desc: "오늘·3일·7일 이내 기일을 색상으로 구분" },
      { title: "기일 달력 & 팝업 관리", desc: "날짜별 기일 등록·수정을 별도 창에서 빠르게" },
      { title: "다가오는 기일 사이드바", desc: "14일 이내 예정 기일을 D-Day와 함께 표시" },
      { title: "기일 엑셀 round-trip", desc: "datelist 형식으로 일정 일괄 가져오기·보내기" },
    ],
    reverse: true,
  },
  {
    id: "workflow",
    tag: "TEAM WORKFLOW",
    title: "결재·상담·수납까지\n하나의 송무 허브",
    description:
      "기안부터 결재·반려·이력까지 전자결재를 지원하고, 상담·고객·메신저·회계 모듈이 사건 데이터와 연결됩니다.",
    points: [
      { title: "다단계 전자결재", desc: "REVIEWER 1~4 결재선, 타임라인·첨부 다운로드" },
      { title: "상담·고객·직원 관리", desc: "의뢰인 정보, 상담 이력, 담당자 권한 통합" },
      { title: "사내·외부 메신저", desc: "팀 커뮤니케이션을 사건 맥락 안에서" },
      { title: "회계/수납·통계", desc: "수임료·미수금 현황과 사건·업무 통계" },
    ],
    reverse: false,
  },
] as const;

export const WWW_AUDIENCE = [
  {
    id: "firm",
    label: "for Law Firm",
    title: "변호사가 해야 할 일,\n사람에게 맡길 일만 남기세요",
    subtitle: "반복되는 사건·기일 관리는 시스템이, 핵심 법리와 판단은 변호사가.",
    cards: [
      {
        title: "담당 사건 한 화면",
        desc: "사건번호·의뢰인·다음 기일·D-Day를 테이블 한 곳에서 확인하고 바로 상세로 이동합니다.",
      },
      {
        title: "기일 놓침 방지",
        desc: "오늘 기일은 강조 표시, 3일·7일 이내 기일은 경고 색상으로 팀 전체가 인지합니다.",
      },
      {
        title: "LawTop형 업무 이관",
        desc: "기존 엑셀·레거시 송무 데이터를 import preview로 검증 후 일괄 이관합니다.",
      },
    ],
  },
  {
    id: "office",
    label: "for Office",
    title: "사무장·행정팀이\n매일 쓰는 송무 백오피스",
    subtitle: "결재, 고객, 수납, 공지 — 사건 흐름에 맞춘 행정 업무 자동화.",
    cards: [
      {
        title: "전자결재 & 공지 연동",
        desc: "기안·결재 대기를 대시보드에서 확인하고, 공지 게시판과 업무 화면이 동기화됩니다.",
      },
      {
        title: "고객·회원 일괄 관리",
        desc: "고객 import preview, 담당변경 일괄처리로 대량 업무를 빠르게 처리합니다.",
      },
      {
        title: "수납·미수금 추적",
        desc: "이번 달 수임료, 미수금 건수를 대시보드 통계 카드로 한눈에 파악합니다.",
      },
    ],
  },
] as const;

export const WWW_TESTIMONIALS = [
  {
    quote:
      "엑셀과 메모에 흩어져 있던 사건을 LawyGo로 옮긴 뒤, 다음 기일을 놓친 적이 없어요. 대시보드만 보면 오늘 할 일이 정리됩니다.",
    name: "김○○",
    role: "개인 로펌 · 담당변호사",
  },
  {
    quote:
      "결재·공지·사건 목록이 따로 놀지 않아서 사무장 업무가 훨씬 수월해졌어요. import preview 덕분에 엑셀 이관도 안심하고 했습니다.",
    name: "이○○",
    role: "법무법인 · 사무국장",
  },
  {
    quote:
      "담당변경 일괄처리와 기일 달력이 특히 좋아요. 팀원이 바뀌어도 사건 히스토리와 자료실이 그대로 이어집니다.",
    name: "박○○",
    role: "중형 로펌 · 송무팀장",
  },
  {
    quote:
      "법원 동기화로 사건 정보 입력 시간이 줄었고, 의뢰인별 탭 제목까지 자동이라 여러 사건을 동시에 다루기 편합니다.",
    name: "정○○",
    role: "송무 전담 · 어쏘 변호사",
  },
] as const;

export const WWW_STATS = [
  { value: "기일", label: "D-Day 자동 집계", sub: "오늘·3일·7일 카드" },
  { value: "엑셀", label: "LawTop형 round-trip", sub: "import preview 지원" },
  { value: "결재", label: "다단계 워크플로우", sub: "REVIEWER 1~4" },
  { value: "통합", label: "15+ 업무 모듈", sub: "사건·기일·결재·수납" },
] as const;

export const WWW_SECURITY = [
  {
    title: "세션 기반 인증",
    desc: "사이트 회원·Google OAuth 로그인, 역할별 메뉴·권한 분리",
  },
  {
    title: "Supabase + RLS",
    desc: "데이터베이스 Row Level Security로 조직별 데이터 보호",
  },
  {
    title: "Vercel 배포",
    desc: "HTTPS, 환경 변수 분리, 프로덕션·개발 환경 격리",
  },
] as const;

export const WWW_FAQ = [
  {
    q: "기존 LawTop GL 엑셀 데이터를 가져올 수 있나요?",
    a: "네. LawTop형 엑셀 형식으로 사건·기일·고객·회원 데이터를 import preview로 검증한 뒤 일괄 등록할 수 있습니다.",
  },
  {
    q: "소형 로펌도 사용할 수 있나요?",
    a: "LawyGo Core는 1인 로펌·소형 사무소를 위해 설계되었습니다. 사건·기일·고객·대시보드 핵심 기능을 바로 사용할 수 있습니다.",
  },
  {
    q: "결재선은 몇 단계까지 지원하나요?",
    a: "REVIEWER 1부터 4까지 다단계 결재선을 지원하며, 결재 타임라인·이력·첨부파일 다운로드를 제공합니다.",
  },
  {
    q: "법원 사건 정보는 어떻게 연동되나요?",
    a: "법원 포털 연동 API를 통해 사건 정보를 동기화할 수 있습니다. (환경 설정 및 권한에 따라 사용)",
  },
  {
    q: "Enterprise 도입은 어떻게 진행되나요?",
    a: "조직 규모·연동 범위·보안 요구사항에 맞춰 맞춤 견적과 도입 일정을 안내해 드립니다. 로그인 후 문의해 주세요.",
  },
] as const;

export const WWW_PRICING_PLANS = [
  {
    product: "core" as const,
    name: "Core",
    price: "문의",
    originalPrice: null,
    period: "로펌 규모별",
    badge: "핵심 송무",
    highlight: false,
    features: [
      "사건·기일·고객 관리",
      "업무 대시보드",
      "기일 달력",
      "엑셀 import/export",
      "공지 게시판",
      "Google 로그인",
    ],
  },
  {
    product: "professional" as const,
    name: "Professional",
    price: "문의",
    originalPrice: null,
    period: "팀 단위",
    badge: "인기",
    highlight: true,
    features: [
      "Core 전체 기능",
      "전자결재 (다단계)",
      "상담·메신저",
      "회계/수납·통계",
      "직원·권한 관리",
      "담당변경 일괄처리",
    ],
  },
  {
    product: "enterprise" as const,
    name: "Enterprise",
    price: "맞춤 견적",
    originalPrice: null,
    period: "기업·그룹",
    badge: null,
    highlight: false,
    features: [
      "Professional 전체",
      "SSO · 조직 연동",
      "맞춤 결재·워크플로우",
      "법원 동기화 확장",
      "전용 클라우드 옵션",
      "전담 도입 지원",
    ],
  },
] as const;

export const WWW_NAV_FEATURES = [
  { label: "사건 관리", href: "#feature-cases" },
  { label: "기일 추적", href: "#feature-deadline" },
  { label: "전자결재", href: "#feature-workflow" },
  { label: "업무 대시보드", href: "#product" },
  { label: "엑셀 연동", href: "#feature-cases" },
  { label: "팀 협업", href: "#feature-workflow" },
] as const;
