/** 웹앱 scourtPartyName.ts 와 동일 규칙 */
const PARTY_FORBIDDEN = /[$\\#%^&*+_`~=|,'"\-:;％/]/g;

export function normalizePartyNameForScourt(raw: string): string {
  let name = String(raw ?? "").trim();
  if (!name) return "";
  name = name.split(/[(（]/)[0]?.trim() ?? name;
  name = name.split(/[,，、]/)[0]?.trim() ?? "";
  name = name.replace(/\s*(외|外)\s*\d*\s*$/u, "").trim();
  name = name.replace(PARTY_FORBIDDEN, "");
  name = name.replace(/\s+/g, "");
  return name;
}
