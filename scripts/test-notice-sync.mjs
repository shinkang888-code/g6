/**
 * 공지사항 API·게시판 연동 검증
 * node scripts/test-notice-sync.mjs [baseUrl]
 */

const base = process.argv[2] ?? "http://localhost:3000";

async function req(path, options = {}) {
  const res = await fetch(`${base}${path}`, options);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

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

console.log(`=== 공지 API (${base}) ===`);

const list = await req("/api/notices?page=1&page_size=5");
assert("GET /api/notices 성공", list.res.ok && list.json.success);
assert("공지 1건 이상", Array.isArray(list.json.data) && list.json.data.length > 0);

const first = list.json.data?.[0];
if (first?.numId) {
  const detail = await req(`/api/notices/${first.numId}`);
  assert("GET /api/notices/[numId]", detail.res.ok && detail.json.success);
}

console.log("\n=== 공지 게시판 API ===");
const board = await req("/api/board/notice");
assert("GET /api/board/notice 성공", board.res.ok && board.json.success);
assert("source lawygo", board.json.source === "lawygo");
assert("대시보드·게시판 데이터 일치", board.json.data?.[0]?.subject === first?.title);

const uniqueTitle = `연동테스트 ${Date.now()}`;
const created = await req("/api/board/notice", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    wr_subject: uniqueTitle,
    wr_content: "대시보드·게시판 동기화 테스트",
    wr_name: "테스트",
  }),
});
assert("POST 공지 등록", created.res.ok && created.json.success);

const after = await req("/api/notices?q=" + encodeURIComponent(uniqueTitle));
assert("등록 후 API 목록 반영", after.json.data?.some((n) => n.title === uniqueTitle));

console.log(`\n결과: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
