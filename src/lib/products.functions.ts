import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

const productSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "lowercase, digits, dashes"),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().min(1).max(80),
  price_rwf: z.number().int().nonnegative().max(100_000_000),
  compare_at_price_rwf: z.number().int().nonnegative().max(100_000_000).optional().nullable(),
  stock: z.number().int().nonnegative().max(1000000),
  image_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
  spec_1: z.string().max(80).optional().nullable(),
  spec_2: z.string().max(80).optional().nullable(),
  active: z.boolean().default(true),
  product_type: z.enum(["physical", "digital_circuit"]).default("physical"),
  low_stock_threshold: z.number().int().nonnegative().max(10000).optional(),
  weight_grams: z.number().nonnegative().max(1000000).optional().nullable(),
  extra_images: z.array(z.string().url().max(500)).max(20).optional(),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => productSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { extra_images, ...rest } = data;
    const payload = { ...rest, image_url: rest.image_url || null };
    const { data: row, error } = data.id
      ? await supabaseAdmin.from("products").update(payload).eq("id", data.id).select().single()
      : await supabaseAdmin.from("products").insert(payload).select().single();
    if (error) throw new Error(error.message);

    if (row && extra_images) {
      await supabaseAdmin.from("product_images").delete().eq("product_id", row.id);
      if (extra_images.length > 0) {
        await supabaseAdmin.from("product_images").insert(
          extra_images.map((url, i) => ({
            product_id: row.id, url, sort_order: i, is_primary: false,
          })),
        );
      }
    }
    return row;
  });

export const getProductImages = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("product_images")
      .select("url, sort_order")
      .eq("product_id", data.product_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => r.url);
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // A product that was ever ordered is archived (hidden), never erased.
    const { count } = await supabaseAdmin.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", data.id);
    if ((count ?? 0) > 0) {
      const { error } = await supabaseAdmin.from("products").update({ active: false }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, archived: true };
    }
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, archived: false };
  });

export const listAdminProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Moves an order forward (processing → shipped → delivered; cash orders may also be marked paid).
 * Runs through the ADMIN'S OWN client, so the database trigger that locks payment fields applies.
 * Cancelling goes through adminCancelOrder (it returns stock and starts the refund).
 */
export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["paid", "processing", "shipped", "delivered"]),
      tracking_number: z.string().trim().max(80).optional(),
      carrier: z.string().trim().max(60).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: { status: string; tracking_number?: string; carrier?: string } = { status: data.status };
    if (data.tracking_number) patch.tracking_number = data.tracking_number;
    if (data.carrier) patch.carrier = data.carrier;
    const { error } = await context.supabase.from("orders").update(patch).eq("id", data.id);
    if (error) {
      const m = error.message;
      if (m.includes("PAID_ONLY_BY_PROVIDER")) throw new Error("A mobile money order becomes paid only when pawaPay confirms it. Use “Recheck payment”.");
      if (m.includes("ORDER_NOT_PAID")) throw new Error("This mobile money order is not paid yet.");
      throw new Error(m);
    }
    return { ok: true };
  });

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isAdmin: !!data };
  });
