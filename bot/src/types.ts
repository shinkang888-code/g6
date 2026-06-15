/**
 * 파싱봇 공용 타입
 * - SearchParams: court.htm(sanoform) 입력 필드에 대응
 * - CaseBasicData: LawTop 의 CaseBasicData.txt(라벨|값) 포맷에 대응
 */

/** 나의사건검색 1건 조회 파라미터 (court.htm sanoform 필드 대응) */
export interface SearchParams {
  /** 법원명 (select option text, 예: "대구지방법원"). 코드(sch_bub_cd)는 페이지가 자동 매핑 */
  courtName: string;
  /** 사건 연도 (sa_year, 예: "2025") */
  year: string;
  /** 사건구분 (sa_gubun option text, 예: "노", "가단", "고단") */
  gubun: string;
  /** 사건 일련번호 (sa_serial, 숫자 7자리 이내, 예: "5285") */
  serial: string;
  /** 당사자명 (ds_nm, 2자 이상, 특수문자 금지) */
  partyName: string;
  /** 내부 사건 매칭용 (선택) - 결과에 같이 실려 LawyGo 사건과 연결 */
  matchCaseId?: string;
}

/** 조회 결과 (LawTop CaseBasicData 라벨에 대응) */
export interface CaseBasicData {
  court: string;            // 법원
  client: string;           // 의뢰인 (조회한 당사자명)
  serial: string;           // 일련번호
  matchCourt?: string;      // 매치법원
  caseCode?: string;        // 고유번호 (예: 노)
  year?: string;            // 연도
  matchClient?: string;     // 매치의뢰인
  dateMatched?: boolean;    // 기일매치 (Y/N)
  caseKey?: string;         // 사건키 (법원 시스템 내부 키)
  caseNumber: string;       // 사건번호 (예: 2025노5285)
  caseName?: string;        // 사건명
  defendantName?: string;   // 피고인명 (마스킹된 형태, 예: 이OO)
  court_division?: string;  // 재판부 (전화 포함 가능)
  receivedDate?: string;    // 접수일 (예: 2025.12.31)
  finalResult?: string;     // 종국결과
  caseManageNo?: string;    // 형제번호 (예: 2025형제23292)
  appealInfo?: string;      // 상소제기내용
  /** 사건 진행/기일 내역 (결과 페이지 표에서 추출) */
  events?: CaseEvent[];
  /** 원본 라벨|값 라인 (LawTop CaseBasicData.txt 호환) */
  rawLine?: string;
  /** 매칭 대상 LawyGo 사건 id (요청 시 전달된 값) */
  matchCaseId?: string;
}

/** 사건 진행/기일 1건 */
export interface CaseEvent {
  date?: string;     // 일자
  time?: string;     // 시각
  type?: string;     // 기일구분 (공판기일, 선고기일 등)
  place?: string;    // 기일장소 (예: 신별관 제201호 법정)
  detail?: string;   // 내용
  result?: string;   // 결과 (속행, 변론종결 등)
}

/** 1건 조회 산출물 */
export interface SearchOutcome {
  ok: boolean;
  params: SearchParams;
  data?: CaseBasicData;
  /** 조회 결과 없음(존재하지 않는 사건/당사자 불일치 등) */
  notFound?: boolean;
  error?: string;
  /** OCR 캡차 시도 횟수 */
  captchaAttempts?: number;
  /** 결과 페이지 원본 HTML (디버깅/재파싱용) */
  rawHtml?: string;
}
