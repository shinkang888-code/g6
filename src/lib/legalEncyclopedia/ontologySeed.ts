/**
 * 로이고법률백과 — 온톨로지 시드 (민법·형법·상법·소송법 등)
 * DB 시드 및 오프라인 폴백 공용
 */

import type { LegalDomain } from "./types";

export type OntologySeedEntry = {
  keyword: string;
  synonyms: string[];
  domain: LegalDomain;
  relatedLaws: string[];
};

export const ONTOLOGY_SEED: OntologySeedEntry[] = [
  // 민법
  { keyword: "채권자취소권", synonyms: ["사해행위", "채권자취소", "사해행위취소"], domain: "민법", relatedLaws: ["민법 제406조", "민사소송법"] },
  { keyword: "사해행위", synonyms: ["채권자취소권", "사해의사", "사해행위취소"], domain: "민법", relatedLaws: ["민법 제406조"] },
  { keyword: "손해배상", synonyms: ["불법행위", "채무불이행", "배상청구", "정신적손해"], domain: "민법", relatedLaws: ["민법 제750조", "민법 제390조", "민법 제751조"] },
  { keyword: "불법행위", synonyms: ["손해배상", "과실상계", "공동불법행위"], domain: "민법", relatedLaws: ["민법 제750조", "민법 제760조"] },
  { keyword: "계약해지", synonyms: ["계약종료", "해제", "해지통보", "계약해제"], domain: "민법", relatedLaws: ["민법 제543조", "민법 제544조"] },
  { keyword: "이혼", synonyms: ["혼인파탄", "재판이혼", "협의이혼", "이혼청구"], domain: "민법", relatedLaws: ["민법 제840조", "민법 제843조"] },
  { keyword: "소멸시효", synonyms: ["시효완성", "시효중단", "시효이익"], domain: "민법", relatedLaws: ["민법 제162조", "민법 제168조"] },
  { keyword: "임대차", synonyms: ["전세", "월세", "임차권", "대항력"], domain: "민법", relatedLaws: ["민법 제618조", "주택임대차보호법"] },
  { keyword: "유류분", synonyms: ["유류분반환", "유류분침해", "특별수익"], domain: "민법", relatedLaws: ["민법 제1113조", "민법 제1119조"] },
  { keyword: "점유", synonyms: ["점유이전", "점유취득", "타주점유"], domain: "민법", relatedLaws: ["민법 제192조", "민법 제245조"] },
  // 형법
  { keyword: "횡령", synonyms: ["배임", "업무상횡령", "재물점유이탈"], domain: "형법", relatedLaws: ["형법 제355조", "형법 제356조"] },
  { keyword: "배임", synonyms: ["횡령", "업무상배임", "위임사무위반"], domain: "형법", relatedLaws: ["형법 제355조", "형법 제356조"] },
  { keyword: "사기", synonyms: ["편취", "기망", "사기죄", "컴퓨터등사용사기"], domain: "형법", relatedLaws: ["형법 제347조", "형법 제347조의2"] },
  { keyword: "살인", synonyms: ["살인죄", "예비살인", "강도살인"], domain: "형법", relatedLaws: ["형법 제250조", "형법 제251조"] },
  { keyword: "명예훼손", synonyms: ["모욕", "허위사실", "사실적시"], domain: "형법", relatedLaws: ["형법 제307조", "형법 제311조"] },
  { keyword: "뇌물", synonyms: ["뇌물수수", "뇌물공여", "알선수재"], domain: "형법", relatedLaws: ["형법 제129조", "형법 제133조"] },
  // 상법
  { keyword: "주주총회", synonyms: ["주총", "주주결의", "이사회"], domain: "상법", relatedLaws: ["상법 제363조", "상법 제391조"] },
  { keyword: "이사의책임", synonyms: ["주의의무", "충실의무", "이사회책임"], domain: "상법", relatedLaws: ["상법 제382조", "상법 제399조"] },
  { keyword: "회사해산", synonyms: ["청산", "해산사유", "청산인"], domain: "상법", relatedLaws: ["상법 제520조", "상법 제542조"] },
  { keyword: "주식매수청구권", synonyms: ["MBO", "주식공개매수", "소수주주"], domain: "상법", relatedLaws: ["상법 제360조의2", "자본시장법"] },
  { keyword: "상행위", synonyms: ["대리상", "중개업", "상인"], domain: "상법", relatedLaws: ["상법 제46조", "상법 제87조"] },
  // 민사소송법
  { keyword: "소의제기", synonyms: ["소장", "제소", "소송요건"], domain: "민사소송법", relatedLaws: ["민사소송법 제249조", "민사소송법 제256조"] },
  { keyword: "변론종결", synonyms: ["변론기일", "석명준비", "증거조사"], domain: "민사소송법", relatedLaws: ["민사소송법 제145조", "민사소송법 제147조"] },
  { keyword: "상소", synonyms: ["항소", "상고", "항소이유"], domain: "민사소송법", relatedLaws: ["민사소송법 제396조", "민사소송법 제422조"] },
  { keyword: "가처분", synonyms: ["가압류", "보전처분", "집행정지"], domain: "민사소송법", relatedLaws: ["민사소송법 제300조", "민사집행법"] },
  // 형사소송법
  { keyword: "구속영장", synonyms: ["구속", "영장실질심사", "구속적부심"], domain: "형사소송법", relatedLaws: ["형사소송법 제70조", "형사소송법 제200조"] },
  { keyword: "공소시효", synonyms: ["시효정지", "시효완성", "공소권"], domain: "형사소송법", relatedLaws: ["형사소송법 제249조", "형사소송법 제252조"] },
  { keyword: "피고인신문", synonyms: ["신문조서", "진술거부권", "변호인참여"], domain: "형사소송법", relatedLaws: ["형사소송법 제244조의2"] },
  // 헌법·행정법
  { keyword: "기본권", synonyms: ["평등권", "자유권", "사회권", "청구권"], domain: "헌법", relatedLaws: ["헌법 제10조", "헌법 제37조"] },
  { keyword: "위헌법률", synonyms: ["위헌심판", "법률위헌", "한정위헌"], domain: "헌법", relatedLaws: ["헌법 제107조", "헌법 제111조"] },
  { keyword: "행정처분", synonyms: ["취소소송", "무효확인", "의무이행"], domain: "행정법", relatedLaws: ["행정소송법", "행정절차법"] },
  { keyword: "산업재해", synonyms: ["업무상재해", "산재보상", "근로복지"], domain: "행정법", relatedLaws: ["산업재해보상보험법"] },
  // 기업법무
  { keyword: "특허침해", synonyms: ["특허권", "실용신안", "디자인침해"], domain: "기업법무", relatedLaws: ["특허법", "실용신안법", "디자인보호법"] },
  { keyword: "영업비밀", synonyms: ["부정경쟁", "영업비밀침해", "노하우"], domain: "기업법무", relatedLaws: ["부정경쟁방지법", "영업비밀보호법"] },
  { keyword: "개인정보", synonyms: ["개인정보보호", "정보주체", "동의철회"], domain: "기업법무", relatedLaws: ["개인정보보호법"] },
  { keyword: "근로계약", synonyms: ["해고", "부당해고", "임금체불"], domain: "기업법무", relatedLaws: ["근로기준법", "근로계약법"] },
];

export function ontologySeedToMap(): Record<string, { synonyms: string[]; domain: LegalDomain; relatedLaws: string[] }> {
  const map: Record<string, { synonyms: string[]; domain: LegalDomain; relatedLaws: string[] }> = {};
  for (const e of ONTOLOGY_SEED) {
    map[e.keyword] = { synonyms: e.synonyms, domain: e.domain, relatedLaws: e.relatedLaws };
  }
  return map;
}
