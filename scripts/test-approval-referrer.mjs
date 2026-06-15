/**
 * 결재 참조·결재선 라벨 단위 검증
 * npx tsx scripts/test-approval-referrer.mjs
 */
import assert from "node:assert/strict";
import {
  getApproverLabel,
  isRequiredApproverOrder,
  getApproverRoleHint,
} from "../src/lib/approvalLineConfig.ts";
import { isUserReferrer } from "../src/lib/approvalFilters.ts";

assert.equal(getApproverLabel(1), "결재자1 (1차)");
assert.equal(getApproverLabel(4), "결재자4 (4차)");
assert.equal(isRequiredApproverOrder(1), true);
assert.equal(isRequiredApproverOrder(2), false);
assert.equal(getApproverRoleHint(1), "필수결재자");
assert.equal(getApproverRoleHint(3), "선택결재자");

const doc = {
  id: "d1",
  title: "test",
  type: "기안서",
  status: "결재요청",
  caseId: "",
  caseNumber: "",
  requesterId: "u1",
  requesterName: "기안",
  approvalLine: [],
  createdAt: new Date().toISOString(),
  referrerNames: ["홍길동", "김철수"],
  referrerIds: ["staff-a", "staff-b"],
};

assert.equal(isUserReferrer(doc, "staff-a", "다른이름"), true);
assert.equal(isUserReferrer(doc, "unknown", "홍길동"), true);
assert.equal(isUserReferrer(doc, "unknown", "이몽룡"), false);

console.log("test-approval-referrer: passed");
