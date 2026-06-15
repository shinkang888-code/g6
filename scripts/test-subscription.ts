/**
 * 구독 게이트 유닛 검증 (DB 없이)
 */
import assert from "node:assert/strict";
import { evaluateSubscriptionAccess, rowFromDb } from "../src/lib/subscription/subscriptionService";
import { isBillingExemptPath, canLoginDespiteSubscriptionBlock } from "../src/lib/subscription/subscriptionGate";
import { isSubscriptionExemptManagementNumber } from "../src/lib/subscription/subscriptionConfig";

const future = new Date(Date.now() + 86400000 * 30).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

const activeSub = rowFromDb({
  management_number: "12345",
  status: "active",
  plan_id: "standard_monthly",
  current_period_end: future,
  seat_limit: 50,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

assert.equal(evaluateSubscriptionAccess(activeSub, "12345").allowed, true);

const expiredSub = rowFromDb({
  management_number: "12345",
  status: "trialing",
  plan_id: "standard_monthly",
  trial_ends_at: past,
  current_period_end: past,
  seat_limit: 50,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

assert.equal(evaluateSubscriptionAccess(expiredSub, "12345").allowed, false);
assert.equal(evaluateSubscriptionAccess(expiredSub, "12345", { allowBillingPaths: true }).allowed, true);

assert.equal(isSubscriptionExemptManagementNumber("10000"), true);
assert.equal(isSubscriptionExemptManagementNumber("99999"), false);

assert.equal(isBillingExemptPath("/api/subscription/status"), true);
assert.equal(isBillingExemptPath("/api/admin/cases"), false);

assert.equal(
  canLoginDespiteSubscriptionBlock({ permissionRoleId: "company_admin", role: "관리자" }),
  true
);
assert.equal(canLoginDespiteSubscriptionBlock({ permissionRoleId: null, role: "직원" }), false);

console.log("test-subscription: all assertions passed");
