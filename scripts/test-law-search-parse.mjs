/**
 * 법률검색 조문 파싱 검증
 * node scripts/test-law-search-parse.mjs
 */

function formatLabel(law, no, sub, title) {
  const jo = sub ? `${law} 제${no}조의${sub}` : `${law} 제${no}조`;
  return title ? `${jo} (${title})` : jo;
}

function parseLawArticlesFromAiText(text) {
  const items = [];
  const seen = new Set();

  const lineRe =
    /(?:^|\n)\s*(?:\d+[.)]\s*)?(?:\*\*)?([가-힣][가-힣\s]*?(?:법|령|규칙|규정|조례))(?:\*\*)?\s*제\s*(\d+)\s*조(?:\s*의\s*(\d+))?(?:\s*[-–:：]\s*([^\n]+))?/gi;

  let match;
  while ((match = lineRe.exec(text)) !== null) {
    const key = `${match[1]}|${match[2]}|${match[3] ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      lawName: match[1].trim(),
      articleNo: match[2],
      articleSub: match[3],
      title: match[4]?.trim() ?? "",
      label: formatLabel(match[1].trim(), match[2], match[3], match[4]),
    });
  }
  return items;
}

const sample = `의료법 중 한의사 관련 조항은 다음과 같습니다.

1. **의료법 제2조** - 의료인의 정의
한의사는 의료인에 해당합니다.

2. **의료법 제17조** - 한의사 면허
한의사 면허에 관한 규정입니다.

3. **의료법 제19조** - 한의사의 업무
`;

const parsed = parseLawArticlesFromAiText(sample);
let passed = 0;
let failed = 0;

function assert(name, cond) {
  if (cond) {
    console.log(`  OK  ${name}`);
    passed++;
  } else {
    console.log(`  FAIL ${name}`);
    failed++;
  }
}

console.log("=== 조문 파싱 ===");
assert("3개 조문 추출", parsed.length === 3);
assert("의료법 제2조", parsed.some((a) => a.lawName === "의료법" && a.articleNo === "2"));
assert("의료법 제17조", parsed.some((a) => a.articleNo === "17"));
assert("의료법 제19조", parsed.some((a) => a.articleNo === "19"));

console.log("\n=== URL 생성 ===");
const url = `https://www.law.go.kr/LSW/lsSc.do?menuId=0&subMenu=1&tabMenuId=81&query=${encodeURIComponent("의료법 제2조")}`;
assert("law.go.kr URL", url.includes("lsSc.do") && url.includes("%EC%9D%98%EB%A3%8C%EB%B2%95"));

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
