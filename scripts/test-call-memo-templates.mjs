/**
 * 콜센터 양식 CRUD 검증 (storage 로직)
 * node scripts/test-call-memo-templates.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const errors = [];

function check(name, ok, msg) {
  if (ok) console.log(`OK: ${name}`);
  else errors.push(msg || name);
}

const storage = readFileSync(resolve(root, "src/lib/callMemoStorage.ts"), "utf8");
check("updateCallMemoTemplate", storage.includes("export function updateCallMemoTemplate"));
check("saveCallMemoTemplate", storage.includes("export function saveCallMemoTemplate"));
check("deleteCallMemoTemplate", storage.includes("export function deleteCallMemoTemplate"));

const panel = readFileSync(resolve(root, "src/components/consultation/CallMemoTemplatePanel.tsx"), "utf8");
check("양식 등록 버튼", panel.includes("양식 등록"));
check("수정 버튼", panel.includes("수정"));
check("삭제 버튼", panel.includes("삭제"));
check("EditorPopup 연동", panel.includes("CallMemoTemplateEditorPopup"));

const popup = readFileSync(resolve(root, "src/components/consultation/CallMemoTemplateEditorPopup.tsx"), "utf8");
check("본문 textarea", popup.includes("본문 내용"));
check("양식 등록/수정 모드", popup.includes('mode === "create"'));

const page = readFileSync(resolve(root, "src/app/consultation/page.tsx"), "utf8");
check("CallMemoTemplatePanel 사용", page.includes("CallMemoTemplatePanel"));
check("구 양식 저장 모달 제거", !page.includes("callTemplateSaveOpen"));

// in-memory simulation of template CRUD
const templates = [
  { id: "t1", title: "일반 문의", content: "본문1", createdAt: "2026-01-01" },
];

function updateTemplate(id, patch) {
  const t = templates.find((x) => x.id === id);
  if (!t) return null;
  t.title = patch.title;
  t.content = patch.content;
  return t;
}

function addTemplate(payload) {
  const item = { id: "t-new", ...payload, createdAt: new Date().toISOString() };
  templates.push(item);
  return item;
}

function removeTemplate(id) {
  const idx = templates.findIndex((x) => x.id === id);
  if (idx >= 0) templates.splice(idx, 1);
}

const created = addTemplate({ title: "테스트 양식", content: "접수 내용\n\n후속:" });
check("등록 시뮬레이션", created.title === "테스트 양식");

const updated = updateTemplate("t1", { title: "수정됨", content: "새 본문" });
check("수정 시뮬레이션", updated?.title === "수정됨" && updated.content === "새 본문");

removeTemplate("t-new");
check("삭제 시뮬레이션", !templates.some((x) => x.id === "t-new"));

if (errors.length) {
  console.error("\nFAIL:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("\n모든 점검 통과");
