/**
 * ssgo 나의사건검색(ssgo.scourt.go.kr) DOM 셀렉터 모음.
 *
 * 2026-06 라이브 페이지에서 확인한 실제 ID 기준.
 * WebSquare 프레임워크라 ID 가 'mf_ssgoTopMainTab_contents_content1_body_' 접두로 안정적.
 * 사이트 개편 시 이 파일만 수정하면 됩니다.
 */
const P = "#mf_ssgoTopMainTab_contents_content1_body_";

export const selectors = {
  /** 폼 필드 (라이브 확인됨) */
  form: {
    courtSelect: `${P}sbx_cortCd`, // 법원 선택
    yearSelect: `${P}sbx_csYr`, // 년도 선택
    gubunSelect: `${P}sbx_csDvsCd`, // 사건구분 선택
    serialInput: `${P}ibx_csSerial`, // 사건일련번호
    partyInput: `${P}ibx_btprNm`, // 당사자명
    /** 전체 사건번호 입력(입력모드 토글 시, 예: 17가단10) */
    fullCaseNoInput: `${P}ibx_fullCsNo`,
  },

  /** 캡차 (라이브 확인됨 — 이미지 src 가 blob: 이므로 반드시 element.screenshot 으로 캡처) */
  captcha: {
    image: `${P}img_captcha`,
    input: `${P}ibx_answer`,
    reloadButton: `${P}btn_reloadCaptcha`,
  },

  /** 조회 버튼 (라이브 확인됨) */
  submitButton: `${P}btn_srchCs`,

  /** 사건검색 결과 저장 (PC 쿠키·이력 — 기일연동 시 자동 체크) */
  saveResultCheckbox: `${P}cbx_saveCsRsltYn_input_0`,

  /** 최근기일내용 그리드 — WebSquare 가 AJAX 후 tbody 에 행을 채움 */
  recentEventsGridBody: '[id*="grd_rcntDxdyLst_body_tbody"] tr',
} as const;
