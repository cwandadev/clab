import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

/**
 * Checkout rules (see supabase/migrations/*_shop_core.sql):
 *  - the browser sends product ids + quantities only; the database prices the order
 *  - stock is reserved at checkout; unpaid mobile money orders expire after 15 minutes
 *  - a payment counts only after pawaPay itself confirms it (apply_payment_result)
 */

const DB_ERRORS: Record<string, string> = {
  OUT_OF_STOCK: "Some items just sold out",
  PRODUCT_UNAVAILABLE: "An item in your cart is no longer available. Remove it and try again.",
  BAD_QUANTITY: "Quantities must be between 1 and 99.",
  EMPTY_CART: "Your cart is empty.",
  ORDER_EXPIRED: "This order expired because it was not paid within 15 minutes. Please order again.",
  ORDER_NOT_PAYABLE: "This order can no longer be paid.",
  ORDER_NOT_FOUND: "Order not found.",
  ORDER_NOT_CANCELLABLE: "This order can no longer be cancelled here. Ask us in the support chat.",
  ORDER_NOT_HIDEABLE: "Only finished orders can be removed from your list.",
};

export function friendlyDbError(message: string | undefined): string {
  if (!message) return "Something went wrong. Please try again.";
  for (const [code, text] of Object.entries(DB_ERRORS)) {
    if (message.includes(code)) {
      return code === "OUT_OF_STOCK" ? `${text}: ${message.split("OUT_OF_STOCK:")[1]?.trim() ?? ""}`.trim() : text;
    }
  }
  return message;
}

const placeOrderSchema = z.object({
  items: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).min(1).max(50),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(9).max(20),
    city: z.string().trim().min(1).max(80),
    address: z.string().trim().max(400),
    notes: z.string().trim().max(500).optional().default(""),
  }),
  payment_method: z.enum(["momo", "cash"]),
  pickup: z.boolean(),
  anonymous: z.boolean().default(false),
  display_currency: z.enum(["RWF", "USD", "EUR", "GBP"]).default("RWF"),
});

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => placeOrderSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.pickup && data.customer.address.length < 3) throw new Error("Please enter a delivery address.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("create_checkout_order", {
      _user_id: context.userId,
      _items: data.items as unknown as Json,
      _customer: data.customer as unknown as Json,
      _payment_method: data.payment_method,
      _pickup: data.pickup,
      _anonymous: data.anonymous,
      _display_currency: data.display_currency,
    });
    if (error) throw new Error(friendlyDbError(error.message));
    const row = rows?.[0];
    if (!row) throw new Error("Could not create the order.");
    return row;
  });

export const predictPayerPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ phone: z.string().trim().min(6).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { predictProvider, customerMessageFor } = await import("./pawapay.server");
    try {
      return { ok: true as const, ...(await predictProvider(data.phone)) };
    } catch (e) {
      return { ok: false as const, message: customerMessageFor((e as Error).message) };
    }
  });

export const startMomoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      order_id: z.string().uuid(),
      phone: z.string().trim().min(6).max(20),
      provider: z.enum(["MTN_MOMO_RWA", "AIRTEL_RWA"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const pp = await import("./pawapay.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let phoneNumber: string;
    try {
      phoneNumber = (await pp.predictProvider(data.phone)).phoneNumber; // validates + sanitises the MSISDN
    } catch (e) {
      return { ok: false as const, message: pp.customerMessageFor((e as Error).message) };
    }

    // 1) store the depositId first, so the payment can always be reconciled
    const depositId = crypto.randomUUID();
    const { data: amount, error } = await supabaseAdmin.rpc("start_payment", {
      _order_id: data.order_id, _user_id: context.userId, _deposit_id: depositId,
      _provider: data.provider, _phone: phoneNumber,
    });
    if (error) return { ok: false as const, message: friendlyDbError(error.message) };

    // 2) ask pawaPay to send the PIN prompt
    const fail = async (code: string | undefined, raw: unknown) => {
      await supabaseAdmin.rpc("apply_payment_result", {
        _deposit_id: depositId, _status: "FAILED", _amount: 0, _currency: "RWF",
        _failure_code: code ?? "UNSPECIFIED_FAILURE", _raw: raw as Json,
      });
      return { ok: false as const, message: pp.customerMessageFor(code) };
    };

    try {
      const { http, json } = await pp.initiateDeposit({ depositId, amountRwf: Number(amount), phoneNumber, provider: data.provider });
      if (json.status === "ACCEPTED") return { ok: true as const, deposit_id: depositId };
      if (json.status === "REJECTED") return fail(json.failureReason?.failureCode, json);
      if (http >= 500 || !json.status) {
        // Unknown outcome: only NOT_FOUND is safe to treat as failed (pawaPay docs)
        const check = await pp.checkDeposit(depositId);
        if (check.status === "NOT_FOUND") return fail("UNKNOWN_ERROR", json);
        return { ok: true as const, deposit_id: depositId };
      }
      return fail(json.failureReason?.failureCode, json);
    } catch (e) {
      console.error("[pawaPay] initiate failed", e);
      return { ok: true as const, deposit_id: depositId, note: "Checking payment…" };
    }
  });

/** Polled by the order page. Asks pawaPay directly, so a lost callback changes nothing. */
export const checkPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pp = await import("./pawapay.server");
    await supabaseAdmin.rpc("release_expired_reservations");

    // read through the user's own client: RLS proves the order is theirs (or they are admin)
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("id, status, payment_method, pawapay_deposit_id, payment_failure, expires_at, paid_at, refund_status")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error || !order) throw new Error("Order not found.");

    if (order.payment_method === "momo" && order.status === "pending" && order.pawapay_deposit_id) {
      try {
        const res = await pp.checkDeposit(order.pawapay_deposit_id);
        if (res.status === "FOUND" && res.data && ["COMPLETED", "FAILED"].includes(res.data.status)) {
          await supabaseAdmin.rpc("apply_payment_result", {
            _deposit_id: order.pawapay_deposit_id,
            _status: res.data.status,
            _amount: Number(res.data.amount ?? 0),
            _currency: res.data.currency ?? "RWF",
            _failure_code: res.data.failureReason?.failureCode ?? "",
            _raw: res.data as unknown as Json,
          });
          const { data: fresh } = await context.supabase
            .from("orders")
            .select("id, status, payment_method, pawapay_deposit_id, payment_failure, expires_at, paid_at, refund_status")
            .eq("id", data.order_id)
            .maybeSingle();
          if (fresh) return { ...fresh, failure_message: fresh.payment_failure ? pp.customerMessageFor(fresh.payment_failure) : null };
        }
      } catch (e) {
        console.error("[pawaPay] status check failed", e);
      }
    }
    return { ...order, failure_message: order.payment_failure ? pp.customerMessageFor(order.payment_failure) : null };
  });

export const cancelMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("cancel_my_unpaid_order", { _order_id: data.order_id });
    if (error) throw new Error(friendlyDbError(error.message));
    return { ok: true };
  });

export const hideMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("hide_my_order", { _order_id: data.order_id });
    if (error) throw new Error(friendlyDbError(error.message));
    return { ok: true };
  });
