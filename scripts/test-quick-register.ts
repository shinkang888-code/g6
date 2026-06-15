/**
 * 간편등록 필드·봇 job 빌드 검증
 */
import assert from "node:assert/strict";
import { parseCaseNumber } from "../src/lib/scourtBot.ts";
import {
  buildQuickScourtJob,
  validateQuickRegisterFields,
} from "../src/lib/caseQuickRegister.ts";

const SAMPLE = {
  caseNumber: "2025가소32949",
  courtName: "서울중앙지방법원",
  partyName: "강준철",
};

const parsed = parseCaseNumber(SAMPLE.caseNumber);
assert.equal(parsed?.year, "2025");
assert.equal(parsed?.gubun, "가소");
assert.equal(parsed?.serial, "32949");

const errs = validateQuickRegisterFields(SAMPLE);
assert.equal(Object.keys(errs).length, 0, JSON.stringify(errs));

const job = buildQuickScourtJob(SAMPLE);
assert.ok(job, "job should be built");
assert.equal(job!.courtName, "서울중앙지방법원");
assert.equal(job!.year, "2025");
assert.equal(job!.gubun, "가소");
assert.equal(job!.serial, "32949");
assert.equal(job!.partyName, "강준철");

console.log("test-quick-register: all assertions passed");
console.log("job:", JSON.stringify(job));
