export const LANDING_FEATURES = [
  {
    id: "deadline",
    tag: "DEADLINE TRACKING",
    title: "기일·불변기한을\n한눈에 관리합니다",
    description:
      "다음 기일, D-Day, 불변기한을 자동 집계하고 캘린더·대시보드에서 놓치지 않게 알려드립니다.",
    bullets: ["오늘·3일·7일 기일 카드", "기일 달력 & 팝업 관리", "법원 동기화 연동"],
  },
  {
    id: "case",
    tag: "CASE MANAGEMENT",
    title: "수백 건의 사건도\n정렬·검색·엑셀 연동",
    description:
      "사건번호, 의뢰인, 담당자, 진행상태를 한 화면에서 관리하고 LawTop형 엑셀로 가져오기·보내기가 가능합니다.",
    bullets: ["사건 목록·상세·수정 탭", "의뢰인·담당변경 일괄처리", "메모·자료실 통합"],
  },
  {
    id: "workflow",
    tag: "TEAM WORKFLOW",
    title: "결재·공지·메신저까지\n하나의 송무 허브",
    description:
      "기안·결재선, 내부 공지, 팀 메신저, 고객·수임료 관리를 송무 업무 흐름에 맞게 연결합니다.",
    bullets: ["다단계 결재 & 이력", "업무 대시보드", "고객·직원·권한 관리"],
  },
] as const;

export const LANDING_STATS = [
  { value: "기일", label: "D-Day 자동 집계" },
  { value: "엑셀", label: "LawTop형 round-trip" },
  { value: "결재", label: "다단계 워크플로우" },
  { value: "동기화", label: "법원 사건 연동" },
] as const;

export const LANDING_TRUST_LOGOS = [
  "로펌 A",
  "법무법인 B",
  "기업 법무 C",
  "전문가 D",
  "파트너 E",
  "고객 F",
] as const;
