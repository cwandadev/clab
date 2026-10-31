import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { friendlyDbError } from "./checkout.functions";

async function assertAdmin(supabase: { rpc: Function }, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
}

/** Store the refund row first, then call pawaPay (same consistency rule as deposits). */
async function startRefund(orderId: string, depositId: string, amountRwf: number, adminId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const pp = await import("./pawapay.server");
  const refundId = crypto.randomUUID();
  const { error } = await supabaseAdmin.from("refunds").insert({
    id: refundId, order_id: orderId, deposit_id: depositId, amount_rwf: amountRwf, created_by: adminId,
  });
  if (error) throw new Error(error.message);
  await supabaseAdmin.from("orders").update({ refund_status: "pending" }).eq("id", orderId);

  try {
    const { json } = await pp.initiateRefund({ refundId, depositId, amountRwf });
    if (json.status === "REJECTED") {
      const code = json.rejectionReason?.rejectionCode ?? json.failureReason?.failureCode ?? "REJECTED";
      await supabaseAdmin.rpc("apply_refund_result", { _refund_id: refundId, _status: "FAILED", _failure_code: code, _raw: json as unknown as Json });
      return { refund: "failed" as const, code };
    }
  } catch (e) {
    console.error("[pawaPay] refund initiate failed", e); // stays pending; "Recheck" resolves it
  }
  return { refund: "pending" as const };
}

export const adminCancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ order_id: z.string().uuid(), reason: z.string().trim().max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase.rpc("admin_cancel_order", { _order_id: data.order_id, _reason: data.reason });
    if (error) throw new Error(friendlyDbError(error.message));
    const r = rows?.[0];
    if (r?.refund_deposit_id) return startRefund(data.order_id, r.refund_deposit_id, r.refund_amount_rwf, context.userId);
    return { refund: "none" as const };
  });

export const adminRetryRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin.from("orders")
      .select("id, status, refund_status, pawapay_deposit_id, paid_amount_rwf").eq("id", data.order_id).maybeSingle();
    if (!o || o.status !== "cancelled" || o.refund_status !== "failed" || !o.pawapay_deposit_id || !o.paid_amount_rwf) {
      throw new Error("Only a cancelled, paid order whose refund failed can be retried.");
    }
    return startRefund(o.id, o.pawapay_deposit_id, o.paid_amount_rwf, context.userId);
  });

/** Ask pawaPay about every deposit and refund of an order, and apply what it says. */
export const adminRecheckPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pp = await import("./pawapay.server");
    const results: string[] = [];

    const { data: events } = await supabaseAdmin.from("payment_events").select("deposit_id").eq("order_id", data.order_id);
    for (const depositId of [...new Set((events ?? []).map((e) => e.deposit_id))]) {
      const res = await pp.checkDeposit(depositId);
      if (res.status === "FOUND" && res.data && ["COMPLETED", "FAILED"].includes(res.data.status)) {
        const { data: out } = await supabaseAdmin.rpc("apply_payment_result", {
          _deposit_id: depositId, _status: res.data.status, _amount: Number(res.data.amount ?? 0),
          _currency: res.data.currency ?? "RWF", _failure_code: res.data.failureReason?.failureCode ?? "",
          _raw: res.data as unknown as Json,
        });
        results.push(`deposit ${depositId.slice(0, 8)}: ${res.data.status} → ${out}`);
      } else {
        results.push(`deposit ${depositId.slice(0, 8)}: ${res.data?.status ?? res.status}`);
      }
    }

    const { data: refunds } = await supabaseAdmin.from("refunds").select("id, status").eq("order_id", data.order_id);
    for (const r of refunds ?? []) {
      if (r.status !== "pending") continue;
      const res = await pp.checkRefund(r.id);
      if (res.status === "FOUND" && res.data && ["COMPLETED", "FAILED"].includes(res.data.status)) {
        await supabaseAdmin.rpc("apply_refund_result", {
          _refund_id: r.id, _status: res.data.status, _failure_code: res.data.failureReason?.failureCode ?? "",
          _raw: res.data as unknown as Json,
        });
      } else if (res.status === "NOT_FOUND") {
        await supabaseAdmin.rpc("apply_refund_result", { _refund_id: r.id, _status: "FAILED", _failure_code: "NOT_FOUND", _raw: {} });
      }
      results.push(`refund ${r.id.slice(0, 8)}: ${res.data?.status ?? res.status}`);
    }
    return { results };
  });

export const adminArchiveOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ order_id: z.string().uuid(), archive: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_archive_order", { _order_id: data.order_id, _archive: data.archive });
    if (error) throw new Error(error.message.includes("ORDER_NOT_ARCHIVABLE")
      ? "Only finished orders with no refund in progress can be archived." : error.message);
    return { ok: true };
  });
