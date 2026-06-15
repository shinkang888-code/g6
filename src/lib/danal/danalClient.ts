import crypto from "crypto";
import {
  appBaseUrl,
  danalConfigured,
  getSubscriptionPlan,
} from "@/lib/subscription/subscriptionConfig";

export type DanalPaymentSession = {
  orderId: string;
  amount: number;
  itemName: string;
  userId: string;
  userName: string;
  userEmail?: string;
  returnUrl: string;
  cancelUrl: string;
  /** Danal 결제창 POST URL (테스트/운영) */
  actionUrl: string;
  /** hidden form fields */
  formFields: Record<string, string>;
};

function danalBaseUrl(): string {
  const mode = (process.env.DANAL_MODE ?? "test").trim();
  return mode === "live"
    ? "https://tx-creditcard.danalpay.com/credit/"
    : "https://tx-creditcard.danalpay.com/credit/";
}

function signDanalPayload(fields: Record<string, string>, cppwd: string): string {
  const sorted = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("&");
  return crypto.createHash("sha256").update(sorted + cppwd).digest("hex");
}

export function isDanalReady(): boolean {
  return danalConfigured();
}

export function createDanalMonthlySession(input: {
  managementNumber: string;
  payerName: string;
  payerEmail?: string;
}): DanalPaymentSession | null {
  if (!danalConfigured()) return null;

  const cpid = process.env.DANAL_CPID!.trim();
  const cppwd = process.env.DANAL_CPPWD!.trim();
  const plan = getSubscriptionPlan();
  const orderId = `LG-${input.managementNumber}-${Date.now()}`;
  const base = appBaseUrl();

  const fields: Record<string, string> = {
    CPID: cpid,
    ORDERID: orderId,
    AMOUNT: String(plan.amountKrw),
    ITEMNAME: plan.name,
    USERID: input.managementNumber,
    USERNAME: input.payerName.slice(0, 30),
    USEREMAIL: (input.payerEmail ?? "").slice(0, 50),
    RETURNURL: `${base}/api/subscription/callback/danal`,
    CANCELURL: `${base}/admin/settings/billing?cancelled=1`,
    TXTYPE: "AUTH",
    SERVICETYPE: "DANALCARD",
    CURRENCY: "410",
  };

  fields.SIGN = signDanalPayload(fields, cppwd);

  return {
    orderId,
    amount: plan.amountKrw,
    itemName: plan.name,
    userId: input.managementNumber,
    userName: input.payerName,
    userEmail: input.payerEmail,
    returnUrl: fields.RETURNURL,
    cancelUrl: fields.CANCELURL,
    actionUrl: danalBaseUrl(),
    formFields: fields,
  };
}

export function verifyDanalCallback(
  payload: Record<string, string>
): { ok: boolean; orderId?: string; amount?: number; managementNumber?: string } {
  if (!danalConfigured()) return { ok: false };
  const cppwd = process.env.DANAL_CPPWD!.trim();
  const receivedSign = payload.SIGN ?? payload.sign ?? "";
  const copy = { ...payload };
  delete copy.SIGN;
  delete copy.sign;
  const expected = signDanalPayload(copy, cppwd);
  if (!receivedSign || receivedSign !== expected) return { ok: false };

  const resultCode = payload.RETURNCODE ?? payload.returncode ?? "";
  if (resultCode !== "0000" && resultCode !== "0") return { ok: false };

  const orderId = payload.ORDERID ?? payload.orderid;
  const amount = Number(payload.AMOUNT ?? payload.amount ?? 0);
  const managementNumber = payload.USERID ?? payload.userid;
  return { ok: true, orderId, amount, managementNumber };
}
