/**
 * 대법원 나의사건검색용 당사자명 정규화
 * - 엑셀/DB에 "김창봉 外1", "서영준, 서윤정" 등이 들어온 경우 봇 검증·조회 실패 방지
 */

/** 법원 폼 금지 문자 (bot/saGubun.ts PARTY_FORBIDDEN 과 동일) */
const PARTY_FORBIDDEN = /[$\\#%^&*+_`~=|,'"\-:;％/]/g;

/**
 * 나의사건검색에 넣을 당사자명 정규화
 * 1) 쉼표·顿号 앞 첫 당사자만 사용
 * 2) 끝의 "외 N" / "外N" 제거
 * 3) 금지 특수문자·공백 제거
 */
export function normalizePartyNameForScourt(raw: string): string {
  let name = String(raw ?? "").trim();
  if (!name || name === "(의뢰인 없음)") return "";

  // "박서윤(개명전 ...)" → 괄호 앞 이름만
  name = name.split(/[(（]/)[0]?.trim() ?? name;
  // 쉼표·顿号 앞 첫 당사자
  name = name.split(/[,，、]/)[0]?.trim() ?? "";
  name = name.replace(/\s*(외|外)\s*\d*\s*$/u, "").trim();
  name = name.replace(PARTY_FORBIDDEN, "");
  name = name.replace(/\s+/g, "");

  return name;
}

export function isValidScourtPartyName(raw: string): boolean {
  const n = normalizePartyNameForScourt(raw);
  return n.length >= 2;
}
