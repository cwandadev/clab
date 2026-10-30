// pawaPay callback → re-check with pawaPay → apply in the database.
// The callback body is NEVER trusted: we only read the id from it, then ask
// pawaPay's API for the real status. A forged or replayed callback does nothing.
//
// Deploy:  npx supabase functions deploy pawapay-callback --no-verify-jwt
// Secrets: PAWAPAY_API_TOKEN, PAWAPAY_BASE_URL, SERVICE_KEY (your sb_secret_… key)
import { createClient } from "npm:@supabase/supabase-js@2";

const PAWAPAY_BASE = (Deno.env.get("PAWAPAY_BASE_URL") ?? "https://api.sandbox.pawapay.io").replace(/\/$/, "");
const PAWAPAY_TOKEN = Deno.env.get("PAWAPAY_API_TOKEN") ?? "";
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, { auth: { persistSession: false } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINAL = new Set(["COMPLETED", "FAILED"]);

async function pawapay(path: string) {
  const res = await fetch(`${PAWAPAY_BASE}${path}`, { headers: { Authorization: `Bearer ${PAWAPAY_TOKEN}` } });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  try {
    const depositId = typeof body.depositId === "string" ? body.depositId : null;
    const refundId = typeof body.refundId === "string" ? body.refundId : null;

    if (depositId && UUID.test(depositId)) {
      const r = await pawapay(`/v2/deposits/${depositId}`);
      if (r?.status === "FOUND" && FINAL.has(r.data?.status)) {
        const { data, error } = await db.rpc("apply_payment_result", {
          _deposit_id: depositId,
          _status: r.data.status,
          _amount: Number(r.data.amount ?? 0),
          _currency: r.data.currency ?? "RWF",
          _failure_code: r.data.failureReason?.failureCode ?? "",
          _raw: r.data,
        });
        console.log("deposit", depositId, r.data.status, "→", data ?? error?.message);
      }
    } else if (refundId && UUID.test(refundId)) {
      const r = await pawapay(`/v2/refunds/${refundId}`);
      if (r?.status === "FOUND" && FINAL.has(r.data?.status)) {
        const { data, error } = await db.rpc("apply_refund_result", {
          _refund_id: refundId,
          _status: r.data.status,
          _failure_code: r.data.failureReason?.failureCode ?? "",
          _raw: r.data,
        });
        console.log("refund", refundId, r.data.status, "→", data ?? error?.message);
      }
    }
  } catch (e) {
    console.error("callback error", e);
    return new Response("retry", { status: 500 }); // let pawaPay retry
  }
  return new Response("ok");
});
