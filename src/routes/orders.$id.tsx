import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Smartphone, XCircle, Package, Truck, Store, MessageSquare } from "lucide-react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { formatRwf } from "@/lib/currency";
import { checkPaymentStatus, startMomoPayment, cancelMyOrder, hideMyOrder, predictPayerPhone } from "@/lib/checkout.functions";
import type { Tables } from "@/integrations/supabase/types";
import { StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/orders/$id")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: `/orders/${params.id}` } as never });
  },
  head: () => ({ meta: [{ title: "Your order — Clab" }] }),
  component: OrderPage,
});

type Order = Tables<"orders"> & { order_items: Tables<"order_items">[] };
type Provider = "MTN_MOMO_RWA" | "AIRTEL_RWA";
const PROVIDER_LABEL: Record<string, string> = { MTN_MOMO_RWA: "MTN MoMo", AIRTEL_RWA: "Airtel Money" };

function OrderPage() {
  const { id } = Route.useParams();
  const check = useServerFn(checkPaymentStatus);
  const startPay = useServerFn(startMomoPayment);
  const cancel = useServerFn(cancelMyOrder);
  const hide = useServerFn(hideMyOrder);
  const predict = useServerFn(predictPayerPhone);

  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [retry, setRetry] = useState<{ phone: string; provider: Provider | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
    if (!data) setMissing(true);
    else setOrder(data as Order);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const awaitingMomo = order?.status === "pending" && order.payment_method === "momo";

  // Poll pawaPay (through our server) while a mobile money payment is open.
  useEffect(() => {
    if (!awaitingMomo) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await check({ data: { order_id: id } });
        if (!alive) return;
        setFailure(r.failure_message);
        if (r.status !== "pending") { load(); if (r.status === "paid") toast.success("Payment received!"); }
      } catch { /* keep polling */ }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [awaitingMomo, id, check, load]);

  useEffect(() => {
    if (!awaitingMomo) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [awaitingMomo]);

  if (missing) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">We couldn't find this order on your account.</p>
        <Link to="/account" className="mt-4 inline-block underline">My orders</Link>
      </Shell>
    );
  }
  if (!order) return <Shell><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></Shell>;

  const secondsLeft = order.expires_at ? Math.max(0, Math.floor((new Date(order.expires_at).getTime() - now) / 1000)) : 0;
  const finished = ["delivered", "cancelled", "expired", "failed"].includes(order.status);

  async function doRetry() {
    if (!retry?.provider) { toast.error("Choose your network."); return; }
    setBusy(true);
    const r = await startPay({ data: { order_id: id, phone: retry.phone, provider: retry.provider } });
    setBusy(false);
    if (!r.ok) toast.error(r.message);
    else { setRetry(null); setFailure(null); toast.success("Check your phone and enter your PIN."); load(); }
  }

  async function doCancel() {
    if (!confirm("Cancel this order? Nothing has been charged.")) return;
    try { await cancel({ data: { order_id: id } }); toast.success("Order cancelled."); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function doHide() {
    if (!confirm("Remove this order from your list? The shop keeps its record.")) return;
    try { await hide({ data: { order_id: id } }); toast.success("Removed from your list."); window.location.href = "/account"; }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Order</p>
          <h1 className="font-mono text-2xl font-medium">{order.order_code}</h1>
        </div>
        <StatusPill status={order.status} />
      </div>

      <Steps order={order} />

      {awaitingMomo && (
        <section className="mt-8 rounded-lg border border-accent/40 bg-accent/5 p-5">
          {!retry ? (
            <>
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 size-5 text-accent" />
                <div className="flex-1">
                  <p className="font-medium">Approve {formatRwf(order.total_rwf)} on your phone</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.payer_phone
                      ? <>A {PROVIDER_LABEL[order.payment_provider ?? ""] ?? "mobile money"} prompt was sent to <span className="font-mono">+{order.payer_phone}</span>. Enter your PIN to confirm.</>
                      : "Start the payment below."}
                  </p>
                  {failure && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{failure}</p>}
                  <p className="mt-3 font-mono text-xs text-muted-foreground">
                    {secondsLeft > 0 ? `Held for you: ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : "Time is up — refreshing…"}
                    {!failure && secondsLeft > 0 && <Loader2 className="ml-2 inline size-3 animate-spin" />}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setRetry({ phone: order.payer_phone?.replace(/^250/, "") ?? "", provider: (order.payment_provider as Provider) ?? null })}
                  className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-secondary">
                  {failure ? "Try again" : "Resend / change number"}
                </button>
                <button onClick={doCancel} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive">Cancel order</button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="font-medium">Pay {formatRwf(order.total_rwf)}</p>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-secondary px-3 font-mono text-sm">+250</span>
                <input type="tel" value={retry.phone} inputMode="numeric"
                  onChange={(e) => setRetry({ ...retry, phone: e.target.value })}
                  onBlur={async () => { const r = await predict({ data: { phone: retry.phone } }); if (r.ok) setRetry((x) => x && { ...x, provider: r.provider }); }}
                  className="w-full rounded-r-md border border-input bg-background px-3 py-2 font-mono text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["MTN_MOMO_RWA", "AIRTEL_RWA"] as Provider[]).map((p) => (
                  <button key={p} type="button" onClick={() => setRetry({ ...retry, provider: p })}
                    className={`rounded-md border px-3 py-2 text-sm ${retry.provider === p ? "border-accent bg-accent/10 font-medium" : "border-input"}`}>
                    {PROVIDER_LABEL[p]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={doRetry} disabled={busy} className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60">
                  {busy && <Loader2 className="size-4 animate-spin" />} Send prompt
                </button>
                <button onClick={() => setRetry(null)} className="rounded-md px-3 py-2 text-sm text-muted-foreground">Back</button>
              </div>
            </div>
          )}
        </section>
      )}

      {order.status === "pending" && order.payment_method === "cash" && (
        <Notice icon={<Package className="size-5" />}>
          We're preparing your order. Pay <b>{formatRwf(order.total_rwf)}</b> in cash {order.pickup_option ? "when you pick it up" : "to the courier"}.
          <button onClick={doCancel} className="ml-2 text-sm text-muted-foreground underline hover:text-destructive">Cancel order</button>
        </Notice>
      )}
      {order.status === "shipped" && (
        <Notice icon={order.pickup_option ? <Store className="size-5" /> : <Truck className="size-5" />}>
          {order.pickup_option ? "Ready for pickup at the tieflab shop." : "On the way."}
          {order.tracking_number && <> Tracking: <span className="font-mono">{order.carrier ? `${order.carrier} · ` : ""}{order.tracking_number}</span></>}
        </Notice>
      )}
      {["cancelled", "expired", "failed"].includes(order.status) && (
        <Notice icon={<XCircle className="size-5 text-destructive" />}>
          {order.cancelled_reason ?? "This order was cancelled."}
          {order.refund_status === "pending" && " Your refund is being sent to your mobile money wallet."}
          {order.refund_status === "completed" && " Your refund was sent."}
          {order.refund_status === "failed" && " The refund is delayed — our team is on it."}
        </Notice>
      )}

      <section className="mt-8 rounded-lg border border-border">
        <ul className="divide-y divide-border">
          {order.order_items.map((it) => (
            <li key={it.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
              <span>{it.product_name} <span className="text-muted-foreground">×{it.quantity}</span></span>
              <span className="font-mono">{formatRwf(it.unit_price_rwf * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t border-border px-4 py-3 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{formatRwf(order.subtotal_rwf)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>{order.pickup_option ? "Pickup" : "Delivery"}</span><span className="font-mono">{order.shipping_rwf ? formatRwf(order.shipping_rwf) : "FREE"}</span></div>
          <div className="flex justify-between font-medium"><span>Total</span><span className="font-mono">{formatRwf(order.total_rwf)}</span></div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div><p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">Deliver to</p>
          <p className="mt-1">{order.customer_name} · {order.customer_phone}</p>
          <p className="text-muted-foreground">{order.pickup_option ? "Pickup at the shop" : `${order.address}, ${order.city}`}</p>
          {order.delivery_notes && <p className="mt-1 text-muted-foreground">“{order.delivery_notes}”</p>}
        </div>
        <div><p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">Payment</p>
          <p className="mt-1">{order.payment_method === "momo" ? `${PROVIDER_LABEL[order.payment_provider ?? ""] ?? "Mobile money"}${order.payer_phone ? ` · +${order.payer_phone}` : ""}` : "Cash"}</p>
          <p className="text-muted-foreground">{order.paid_at ? `Paid ${new Date(order.paid_at).toLocaleString()}` : "Not paid yet"}</p>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link to="/account" className="rounded-md border border-input px-3 py-1.5 hover:bg-secondary">All my orders</Link>
        <Link to="/account" hash="chat-section" className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 hover:bg-secondary">
          <MessageSquare className="size-3.5" /> Ask about this order
        </Link>
        {finished && order.refund_status !== "pending" && (
          <button onClick={doHide} className="px-3 py-1.5 text-muted-foreground hover:text-foreground">Remove from my list</button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main" className="mx-auto max-w-2xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}

function Notice({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm">{icon}<div>{children}</div></div>;
}

function Steps({ order }: { order: Tables<"orders"> }) {
  if (["cancelled", "expired", "failed"].includes(order.status)) return null;
  const cash = order.payment_method === "cash";
  const steps = [
    { key: "placed", label: "Placed" },
    { key: "paid", label: cash ? "Confirmed" : "Paid" },
    { key: "processing", label: "Packed" },
    { key: "shipped", label: order.pickup_option ? "Ready" : "On the way" },
    { key: "delivered", label: order.pickup_option ? "Collected" : "Delivered" },
  ];
  const rank: Record<string, number> = { pending: cash ? 1 : 0, paid: 1, processing: 2, shipped: 3, delivered: 4 };
  const at = rank[order.status] ?? 0;
  return (
    <ol className="mt-8 grid grid-cols-5 gap-1">
      {steps.map((s, i) => (
        <li key={s.key} className="flex flex-col items-center gap-1.5 text-center">
          <span className={`grid size-7 place-items-center rounded-full border text-xs ${i <= at ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}>
            {i < at || (i === at && order.status !== "pending") ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={`text-[11px] ${i <= at ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
