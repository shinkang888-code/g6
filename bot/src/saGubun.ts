/**
 * 사건구분 → cmd 생성 로직
 * LawTop GL 의 Resources/court.htm(SearchSano / SearchLinkSano) 에서 그대로 포팅.
 *
 * 원본 JS:
 *   var cmd_sa_gubun = sa_gubun;
 *   if(cmd_sa_gubun == "WKS"||"wks") cmd_sa_gubun = "ks"; ... (W접두 → 소문자 기본코드)
 *   cmd = cmd_sa_gubun + ".SF" + cmd_sa_gubun.toUpperCase() + "01s01Cmd";
 *   // 링크조회(SearchLinkSano): IR/WTD → whp
 *
 * 주의: 여기서 sa_gubun 은 select 의 "value"(예: 가단→"cv", 노→"no")이며,
 *       option "text"(예: "가단")와 다릅니다. 실제 매핑은 safind 의 SaGubun.js 가
 *       페이지에서 채워주므로, 봇은 페이지 select 에서 text 로 선택한 뒤 value 를 읽어
 *       이 함수에 넘기는 것을 기본으로 합니다.
 */

/** W접두 사건구분 → 기본 코드 치환표 (court.htm 과 동일) */
const W_PREFIX_MAP: Record<string, string> = {
  WKS: "ks",
  WHS: "hs",
  WPT: "pt",
  WGJ: "gj",
  WCR: "cr",
  WYM: "ym",
  WGB: "gb",
  WSB: "sb",
  WET: "et",
  WKA: "ka",
  WGO: "go",
};

/**
 * 사건구분 value 로부터 SFSuperSvl cmd 문자열 생성.
 * @param saGubunValue select(sa_gubun) 의 value (예: "cv", "no", "WKS")
 * @param isLink 링크조회(SearchLinkSano) 경로 여부. true 면 IR/WTD → whp 추가 규칙 적용
 */
export function buildCmd(saGubunValue: string, isLink = false): string {
  let code = (saGubunValue ?? "").trim();
  if (!code) return "";

  const upper = code.toUpperCase();
  if (W_PREFIX_MAP[upper]) {
    code = W_PREFIX_MAP[upper];
  }

  if (isLink) {
    const u = code.toUpperCase();
    if (u === "IR" || u === "WTD") code = "whp";
  }

  return `${code}.SF${code.toUpperCase()}01s01Cmd`;
}

/**
 * SFSuperSvl 직접 POST 시 동반되는 hidden 필드 기본값 (court.htm sanoform 기준).
 * 단, cryptKey/callDomain 은 페이지가 세션별로 주입하므로 직접 POST 가 아닌
 * "페이지 구동 방식"을 권장합니다. (bot.ts 참고)
 */
export function baseFormHiddenFields(params: {
  cmd: string;
  schSaGbn: string; // 사건구분 option text
  schBubCd: string; // 법원 코드 (select value)
  isLink?: boolean;
}): Record<string, string> {
  return {
    cmd: params.cmd,
    sch_sa_gbn: params.schSaGbn,
    link: params.isLink ? "Y" : "N",
    theme: "scourt",
    sch_bub_cd: params.schBubCd,
    mysafindYn: "Y",
    listLinkYn: params.isLink ? "Y" : "",
  };
}

/** 당사자명 유효성 (court.htm SearchSano 검증과 동일): 2자 이상, 특수문자 금지 */
const PARTY_FORBIDDEN = /[$\\#%^&*+_`~=|,'"\-:;％/]/;

export function validatePartyName(name: string): { ok: boolean; reason?: string } {
  const v = (name ?? "").replace(/\s/g, "");
  if (v.length < 2) return { ok: false, reason: "당사자명을 2자 이상 입력하십시오." };
  if (PARTY_FORBIDDEN.test(v)) return { ok: false, reason: "당사자명에 특수문자는 사용할 수 없습니다." };
  return { ok: true };
}

/** 사건 일련번호 유효성 (숫자만, court.htm 과 동일) */
export function validateSerial(serial: string): { ok: boolean; reason?: string } {
  const v = (serial ?? "").trim();
  if (!v) return { ok: false, reason: "사건일련번호를 입력하십시오." };
  if (!/^\d+$/.test(v)) return { ok: false, reason: "사건일련번호는 숫자만 입력하십시오." };
  return { ok: true };
}
