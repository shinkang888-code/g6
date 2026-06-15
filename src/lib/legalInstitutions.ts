import { SCOURT_INSTITUTION_NAMES, SCOURT_NAME_ALIASES } from "@/data/scourtCourts";
import type { CaseInstitutionStage } from "@/lib/caseInstitutionTypes";

export type LegalInstitutionCategory =
  | "court"
  | "prosecution"
  | "police"
  | "detention"
  | "other";

export type LegalInstitutionItem = {
  name: string;
  category: LegalInstitutionCategory;
  aliases?: string[];
};

const PROSECUTION_OFFICES: LegalInstitutionItem[] = [
  { name: "대검찰청", category: "prosecution" },
  { name: "서울고등검찰청", category: "prosecution" },
  { name: "대전고등검찰청", category: "prosecution" },
  { name: "대구고등검찰청", category: "prosecution" },
  { name: "부산고등검찰청", category: "prosecution" },
  { name: "광주고등검찰청", category: "prosecution" },
  { name: "서울중앙지방검찰청", category: "prosecution", aliases: ["중앙지검"] },
  { name: "서울동부지방검찰청", category: "prosecution", aliases: ["동부지검"] },
  { name: "서울남부지방검찰청", category: "prosecution", aliases: ["남부지검"] },
  { name: "서울북부지방검찰청", category: "prosecution", aliases: ["북부지검"] },
  { name: "서울서부지방검찰청", category: "prosecution", aliases: ["서부지검"] },
  { name: "의정부지방검찰청", category: "prosecution" },
  { name: "인천지방검찰청", category: "prosecution" },
  { name: "수원지방검찰청", category: "prosecution" },
  { name: "수원지방검찰청 성남지청", category: "prosecution", aliases: ["성남지청"] },
  { name: "수원지방검찰청 안양지청", category: "prosecution", aliases: ["안양지청"] },
  { name: "수원지방검찰청 안산지청", category: "prosecution", aliases: ["안산지청"] },
  { name: "수원지방검찰청 여주지청", category: "prosecution", aliases: ["여주지청"] },
  { name: "수원지방검찰청 평택지청", category: "prosecution", aliases: ["평택지청"] },
  { name: "춘천지방검찰청", category: "prosecution" },
  { name: "강릉지청", category: "prosecution" },
  { name: "원주지청", category: "prosecution" },
  { name: "대전지방검찰청", category: "prosecution" },
  { name: "청주지방검찰청", category: "prosecution" },
  { name: "대구지방검찰청", category: "prosecution" },
  { name: "부산지방검찰청", category: "prosecution" },
  { name: "울산지방검찰청", category: "prosecution" },
  { name: "창원지방검찰청", category: "prosecution" },
  { name: "광주지방검찰청", category: "prosecution" },
  { name: "전주지방검찰청", category: "prosecution" },
  { name: "제주지방검찰청", category: "prosecution" },
];

const POLICE_OFFICES: LegalInstitutionItem[] = [
  { name: "서울지방경찰청", category: "police" },
  { name: "부산지방경찰청", category: "police" },
  { name: "대구지방경찰청", category: "police" },
  { name: "인천지방경찰청", category: "police" },
  { name: "광주지방경찰청", category: "police" },
  { name: "대전지방경찰청", category: "police" },
  { name: "울산지방경찰청", category: "police" },
  { name: "경기남부지방경찰청", category: "police" },
  { name: "경기북부지방경찰청", category: "police" },
  { name: "강원지방경찰청", category: "police" },
  { name: "충북지방경찰청", category: "police" },
  { name: "충남지방경찰청", category: "police" },
  { name: "전북지방경찰청", category: "police" },
  { name: "전남지방경찰청", category: "police" },
  { name: "경북지방경찰청", category: "police" },
  { name: "경남지방경찰청", category: "police" },
  { name: "제주지방경찰청", category: "police" },
  { name: "서울중앙경찰서", category: "police" },
  { name: "서울종로경찰서", category: "police" },
  { name: "서울남대문경찰서", category: "police" },
  { name: "서울마포경찰서", category: "police" },
  { name: "서울강남경찰서", category: "police" },
  { name: "서울강서경찰서", category: "police" },
  { name: "서울송파경찰서", category: "police" },
  { name: "수원중부경찰서", category: "police" },
  { name: "수원남부경찰서", category: "police" },
  { name: "안양경찰서", category: "police" },
  { name: "안산경찰서", category: "police" },
  { name: "성남경찰서", category: "police" },
  { name: "인천남동경찰서", category: "police" },
  { name: "인천부평경찰서", category: "police" },
  { name: "부산해운대경찰서", category: "police" },
  { name: "대구중부경찰서", category: "police" },
  { name: "광주서부경찰서", category: "police" },
  { name: "대전중부경찰서", category: "police" },
];

const DETENTION_FACILITIES: LegalInstitutionItem[] = [
  { name: "서울구치소", category: "detention" },
  { name: "대전구치소", category: "detention" },
  { name: "부산구치소", category: "detention" },
  { name: "대구구치소", category: "detention" },
  { name: "광주구치소", category: "detention" },
  { name: "수원구치소", category: "detention" },
  { name: "인천구치소", category: "detention" },
  { name: "의정부구치소", category: "detention" },
  { name: "청주구치소", category: "detention" },
  { name: "전주구치소", category: "detention" },
  { name: "창원구치소", category: "detention" },
  { name: "제주구치소", category: "detention" },
];

const COURT_ITEMS: LegalInstitutionItem[] = SCOURT_INSTITUTION_NAMES.map((name) => ({
  name,
  category: "court" as const,
  aliases: Object.entries(SCOURT_NAME_ALIASES)
    .filter(([, canonical]) => canonical === name)
    .map(([alias]) => alias),
}));

const ALL_ITEMS: LegalInstitutionItem[] = [
  ...COURT_ITEMS,
  ...PROSECUTION_OFFICES,
  ...POLICE_OFFICES,
  ...DETENTION_FACILITIES,
];

function normalizeSearchText(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function stageCategories(stage?: CaseInstitutionStage): LegalInstitutionCategory[] | null {
  if (!stage) return null;
  if (stage === "police") return ["police"];
  if (stage === "prosecution") return ["prosecution"];
  if (stage === "detention") return ["detention", "other"];
  if (stage.startsWith("court")) return ["court"];
  return null;
}

function itemSearchTargets(item: LegalInstitutionItem): string[] {
  return [item.name, ...(item.aliases ?? [])];
}

function matchesQuery(item: LegalInstitutionItem, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return false;
  return itemSearchTargets(item).some((target) => normalizeSearchText(target).includes(q));
}

function scoreMatch(item: LegalInstitutionItem, query: string): number {
  const q = normalizeSearchText(query);
  let best = 0;
  for (const target of itemSearchTargets(item)) {
    const t = normalizeSearchText(target);
    if (t === q) best = Math.max(best, 100);
    else if (t.startsWith(q)) best = Math.max(best, 80);
    else if (t.includes(q)) best = Math.max(best, 60);
  }
  return best;
}

export type SearchLegalInstitutionsOptions = {
  stage?: CaseInstitutionStage;
  /** scourt 자동조회용 — 법원·행정·가정법원만 */
  scope?: "all" | "scourt";
  limit?: number;
};

export function searchLegalInstitutions(
  query: string,
  options: SearchLegalInstitutionsOptions = {}
): LegalInstitutionItem[] {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const { stage, scope = "all", limit = 12 } = options;
  const categories = stageCategories(stage);

  let pool = ALL_ITEMS;
  if (scope === "scourt") {
    pool = COURT_ITEMS;
  } else if (categories) {
    pool = ALL_ITEMS.filter((item) => categories.includes(item.category));
  }

  const seen = new Set<string>();
  return pool
    .filter((item) => matchesQuery(item, trimmed))
    .sort((a, b) => scoreMatch(b, trimmed) - scoreMatch(a, trimmed))
    .filter((item) => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    })
    .slice(0, limit);
}

export function getLegalInstitutionCategoryLabel(category: LegalInstitutionCategory): string {
  switch (category) {
    case "court":
      return "법원";
    case "prosecution":
      return "검찰";
    case "police":
      return "경찰";
    case "detention":
      return "구금";
    default:
      return "기타";
  }
}
