/**
 * pawaPay v2 client (server only). Docs: https://docs.pawapay.io/v2
 * Only four calls are used: predict-provider, deposits, refunds, and their status checks.
 * Keep this the ONLY file (plus the callback edge function) that knows about pawaPay.
 */

export type PawaPayStatus =
  | "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED" | "SUBMITTED" | "PROCESSING"
  | "ENQUEUED" | "COMPLETED" | "FAILED" | "IN_RECONCILIATION";

export type PawaPayFailure = { failureCode?: string; failureMessage?: string };

export type DepositData = {
  depositId: string;
  status: PawaPayStatus;
  amount?: string;
  currency?: string;
  failureReason?: PawaPayFailure;
  payer?: { accountDetails?: { phoneNumber?: string; provider?: string } };
};

export type RefundData = {
  refundId: string;
  status: PawaPayStatus;
  amount?: string;
  currency?: string;
  failureReason?: PawaPayFailure;
};

export const RW_PROVIDERS = {
  MTN_MOMO_RWA: "MTN MoMo",
  AIRTEL_RWA: "Airtel Money",
} as const;
export type RwProvider = keyof typeof RW_PROVIDERS;

function config() {
  const token = process.env.PAWAPAY_API_TOKEN;
  if (!token) throw new Error("Mobile money is not configured (PAWAPAY_API_TOKEN missing).");
  const base = (process.env.PAWAPAY_BASE_URL || "https://api.sandbox.pawapay.io").replace(/\/$/, "");
  return { token, base };
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<{ http: number; json: T }> {
  const { token, base } = config();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { http: res.status, json: json as T };
}

/** 0783…, 783…, 250783… and +250 783… all become 250783… (pawaPay re-validates). */
export function normalizeRwPhone(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("250")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return `250${d}`;
}

export async function predictProvider(phone: string): Promise<{ phoneNumber: string; provider: RwProvider }> {
  const { http, json } = await call<{ phoneNumber?: string; provider?: string; country?: string }>(
    "POST", "/v2/predict-provider", { phoneNumber: normalizeRwPhone(phone) },
  );
  if (http >= 400 || !json.phoneNumber) throw new Error("INVALID_PHONE");
  if (json.country !== "RWA" || !(json.provider && json.provider in RW_PROVIDERS)) throw new Error("UNSUPPORTED_NETWORK");
  return { phoneNumber: json.phoneNumber, provider: json.provider as RwProvider };
}

export async function initiateDeposit(args: { depositId: string; amountRwf: number; phoneNumber: string; provider: RwProvider }) {
  return call<{ depositId: string; status?: PawaPayStatus; failureReason?: PawaPayFailure }>("POST", "/v2/deposits", {
    depositId: args.depositId,
    amount: String(Math.round(args.amountRwf)),   // RWF has no decimals
    currency: "RWF",
    payer: { type: "MMO", accountDetails: { phoneNumber: args.phoneNumber, provider: args.provider } },
  });
}

export async function checkDeposit(depositId: string) {
  const { json } = await call<{ status: "FOUND" | "NOT_FOUND"; data?: DepositData }>("GET", `/v2/deposits/${depositId}`);
  return json;
}

export async function initiateRefund(args: { refundId: string; depositId: string; amountRwf: number }) {
  return call<{ refundId?: string; status?: PawaPayStatus; rejectionReason?: { rejectionCode?: string }; failureReason?: PawaPayFailure }>(
    "POST", "/v2/refunds",
    { refundId: args.refundId, depositId: args.depositId, amount: String(Math.round(args.amountRwf)), currency: "RWF" },
  );
}

export async function checkRefund(refundId: string) {
  const { json } = await call<{ status: "FOUND" | "NOT_FOUND"; data?: RefundData }>("GET", `/v2/refunds/${refundId}`);
  return json;
}

/** Plain words for the shopper. pawaPay's own failureMessage is for staff only. */
export function customerMessageFor(code: string | null | undefined): string {
  switch (code) {
    case "INSUFFICIENT_BALANCE": return "Your mobile money balance is too low. Top up and try again.";
    case "PAYMENT_NOT_APPROVED": return "The payment was not approved on your phone. Try again and enter your PIN when asked.";
    case "PAYER_NOT_FOUND": return "That number has no mobile money account on this network. Check the number and network.";
    case "PAYER_LIMIT_REACHED": return "Your wallet limit was reached. Try a smaller order or contact your network.";
    case "PROVIDER_TEMPORARILY_UNAVAILABLE": return "The network is down right now. Try again in a few minutes or use the other network.";
    case "AMOUNT_OUT_OF_BOUNDS": return "This amount is outside your wallet limits.";
    case "AMOUNT_MISMATCH": return "The amount received did not match. Our team has been told and will contact you.";
    case "INVALID_PHONE": return "That phone number is not valid.";
    case "UNSUPPORTED_NETWORK": return "Use an MTN or Airtel Rwanda number.";
    default: return "The payment did not go through. You can try again.";
  }
}
