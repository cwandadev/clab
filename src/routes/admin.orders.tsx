import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, X, RefreshCw, Printer, Archive, ArchiveRestore, Loader2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRwf } from "@/lib/currency";
import { updateOrderStatus } from "@/lib/products.functions";
import { adminCancelOrder, adminRecheckPayment, adminArchiveOrder, adminRetryRefund } from "@/lib/admin-orders.functions";
import { StatusPill } from "@/components/StatusPill";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

type Order = Tables<"orders"> & { order_items: Tables<"order_items">[] };

const TABS = [
  { id: "dispatch", label: "To dispatch", match: (o: Order) => !o.archived_at && (o.status === "paid" || (o.payment_method === "cash" && o.status === "pending")) },
  { id: "progress", label: "In progress", match: (o: Order) => !o.archived_at && (o.status === "processing" || o.status === "shipped") },
  { id: "awaiting", label: "Awaiting payment", match: (o: Order) => !o.archived_at && o.status === "pending" && o.payment_method === "momo" },
  { id: "attention", label: "Needs attention", match: (o: Order) => !o.archived_at && (o.refund_status === "pending" || o.refund_status === "failed" || o.payment_failure === "AMOUNT_MISMATCH") },
  { id: "done", label: "Done", match: (o: Order) => !o.archived_at && ["delivered", "cancelled", "expired", "failed"].includes(o.status) },
  { id: "archived", label: "Archived", match: (o: Order) => !!o.archived_at },
] as const;

function AdminOrders() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("dispatch");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const o = new URLSearchParams(window.location.search).get("o");
    if (o) setOpenId(o);
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*)")
        .order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as Order[];
    },
    refetchInterval: 20000,
  });

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.id, orders.filter(t.match).length])), [orders]);
  const shown = useMemo(() => {
    const t = TABS.find((x) => x.id === tab)!;
    const needle = q.trim().toLowerCase();
    return orders.filter(t.match).filter((o) =>
      !needle || [o.order_code, o.customer_name, o.customer_email, o.customer_phone, o.payer_phone]
        .some((v) => v?.toLowerCase().includes(needle)));
  }, [orders, tab, q]);

  const open = orders.find((o) => o.id === openId) ?? null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-orders"] });

  function exportCsv() {
    const rows = [["code", "created", "customer", "phone", "city", "status", "method", "total_rwf", "paid_at"],
      ...shown.map((o) => [o.order_code, o.created_at, o.customer_name, o.customer_phone, o.city, o.status, o.payment_method, o.total_rwf, o.paid_at])];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `orders-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-medium">Orders</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, name, phone…"
              className="w-56 rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm" />
          </div>
          <button onClick={exportCsv} className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-secondary">Export</button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t.id ? "border-accent font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label} <span className="ml-1 font-mono text-xs text-muted-foreground">{counts[t.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-black/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>{["Order", "Customer", "Delivery", "Items", "Total", "Pay", "Status"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((o) => (
                <tr key={o.id} onClick={() => setOpenId(o.id)} className="cursor-pointer hover:bg-secondary/50">
                  <td className="px-4 py-3"><div className="font-mono">{o.order_code}</div><div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div></td>
                  <td className="px-4 py-3"><div>{o.customer_name}</div><div className="text-xs text-muted-foreground">{o.customer_phone}</div></td>
                  <td className="px-4 py-3 text-xs">{o.pickup_option ? "Pickup" : o.city}</td>
                  <td className="px-4 py-3 font-mono text-xs">{o.order_items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="px-4 py-3 font-mono">{formatRwf(o.total_rwf)}</td>
                  <td className="px-4 py-3 text-xs">{o.payment_method === "momo" ? (o.paid_at ? "MoMo ✓" : "MoMo") : "Cash"}</td>
                  <td className="px-4 py-3"><StatusPill status={o.status} />{o.refund_status && <div className="mt-1 text-[10px] text-muted-foreground">refund: {o.refund_status}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <OrderSheet order={open} onClose={() => { setOpenId(null); history.replaceState(null, "", "/admin/orders"); }} onChange={refresh} />}
    </div>
  );
}

function OrderSheet({ order, onClose, onChange }: { order: Order; onClose: () => void; onChange: () => void }) {
  const setStatus = useServerFn(updateOrderStatus);
  const cancel = useServerFn(adminCancelOrder);
  const recheck = useServerFn(adminRecheckPayment);
  const archive = useServerFn(adminArchiveOrder);
  const retryRefund = useServerFn(adminRetryRefund);
  const [busy, setBusy] = useState<string | null>(null);
  const [tracking, setTracking] = useState({ carrier: order.carrier ?? "", number: order.tracking_number ?? "" });
  const [showPhone, setShowPhone] = useState(false);

  const { data: events = [] } = useQuery({
    queryKey: ["payment-events", order.id, order.status, order.refund_status],
    queryFn: async () => (await supabase.from("payment_events").select("*").eq("order_id", order.id).order("created_at")).data ?? [],
  });

  async function run(label: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(label);
    try { const r = await fn(); if (ok) toast.success(ok); onChange(); return r; }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  const cash = order.payment_method === "cash";
  const open = !["cancelled", "expired", "failed", "delivered"].includes(order.status);
  const next: { status: "paid" | "processing" | "shipped" | "delivered"; label: string } | null =
    order.status === "paid" || (cash && order.status === "pending") ? { status: "processing", label: "Start packing" }
    : order.status === "processing" ? { status: "shipped", label: order.pickup_option ? "Mark ready for pickup" : "Mark shipped" }
    : order.status === "shipped" ? { status: "delivered", label: order.pickup_option ? "Mark collected" : "Mark delivered" }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-lg overflow-y-auto bg-background p-6 shadow-2xl print:max-w-none print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Order</p>
            <h2 className="font-mono text-xl">{order.order_code}</h2>
            <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <StatusPill status={order.status} />
            <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-secondary"><X className="size-4" /></button>
          </div>
        </div>

        {order.payment_failure === "AMOUNT_MISMATCH" && <Alert>A payment arrived with the wrong amount. Check the events below and refund it in the pawaPay dashboard.</Alert>}
        {order.refund_status === "failed" && <Alert>The refund failed. Retry it below.</Alert>}

        <section className="mt-6 space-y-1 text-sm">
          <p className="font-medium">{order.customer_name}</p>
          <p className="flex items-center gap-2 text-muted-foreground">
            {showPhone ? <a className="font-mono underline" href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>
              : <button onClick={() => setShowPhone(true)} className="inline-flex items-center gap-1 text-xs underline"><Phone className="size-3" /> Show phone</button>}
            · {order.customer_email}
          </p>
          <p>{order.pickup_option ? "Pickup at the shop" : `${order.address}, ${order.city}`}</p>
          {order.delivery_notes && <p className="text-muted-foreground">“{order.delivery_notes}”</p>}
        </section>

        <ul className="mt-5 divide-y divide-border rounded-lg border border-border text-sm">
          {order.order_items.map((i) => (
            <li key={i.id} className="flex justify-between px-3 py-2"><span>{i.product_name} ×{i.quantity}</span><span className="font-mono">{formatRwf(i.unit_price_rwf * i.quantity)}</span></li>
          ))}
          <li className="flex justify-between px-3 py-2 text-muted-foreground"><span>Delivery</span><span className="font-mono">{formatRwf(order.shipping_rwf)}</span></li>
          <li className="flex justify-between px-3 py-2 font-medium"><span>Total</span><span className="font-mono">{formatRwf(order.total_rwf)}</span></li>
        </ul>

        <section className="mt-5 text-sm">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Payment</p>
          <p className="mt-1">{cash ? "Cash on " + (order.pickup_option ? "pickup" : "delivery")
            : `${order.payment_provider ?? "Mobile money"}${order.payer_phone ? ` · +${order.payer_phone}` : ""}`}
            {order.paid_at && <> · paid {formatRwf(order.paid_amount_rwf)} on {new Date(order.paid_at).toLocaleString()}</>}</p>
          {events.length > 0 && (
            <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-muted-foreground">
              {events.map((e) => <li key={e.id}>{new Date(e.created_at).toLocaleTimeString()} · {e.status}{e.failure_code ? ` (${e.failure_code})` : ""} · {e.deposit_id.slice(0, 8)}</li>)}
            </ul>
          )}
          {order.cancelled_reason && <p className="mt-2 text-muted-foreground">Cancelled: {order.cancelled_reason}</p>}
        </section>

        <div className="mt-6 space-y-3 border-t border-border pt-5 print:hidden">
          {next?.status === "shipped" && !order.pickup_option && (
            <div className="grid grid-cols-2 gap-2">
              <input value={tracking.carrier} onChange={(e) => setTracking({ ...tracking, carrier: e.target.value })} placeholder="Courier (optional)" className="rounded-md border border-input px-3 py-1.5 text-sm" />
              <input value={tracking.number} onChange={(e) => setTracking({ ...tracking, number: e.target.value })} placeholder="Tracking no. (optional)" className="rounded-md border border-input px-3 py-1.5 text-sm" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {next && (
              <button disabled={!!busy} onClick={() => run("next", () => setStatus({ data: { id: order.id, status: next.status, carrier: tracking.carrier || undefined, tracking_number: tracking.number || undefined } }), "Updated")}
                className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60">
                {busy === "next" && <Loader2 className="size-4 animate-spin" />}{next.label}
              </button>
            )}
            {order.payment_method === "momo" && (
              <button disabled={!!busy} onClick={() => run("recheck", async () => {
                const r = await recheck({ data: { order_id: order.id } });
                toast.message(r.results.length ? r.results.join("\n") : "No payment attempts yet.");
              })} className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-secondary">
                <RefreshCw className={`size-3.5 ${busy === "recheck" ? "animate-spin" : ""}`} /> Recheck payment
              </button>
            )}
            {order.refund_status === "failed" && (
              <button disabled={!!busy} onClick={() => run("refund", () => retryRefund({ data: { order_id: order.id } }), "Refund sent again")}
                className="rounded-md border border-input px-3 py-2 text-sm hover:bg-secondary">Retry refund</button>
            )}
            <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-secondary"><Printer className="size-3.5" /> Delivery note</button>
            {!open && order.refund_status !== "pending" && (
              <button disabled={!!busy} onClick={() => run("archive", () => archive({ data: { order_id: order.id, archive: !order.archived_at } }), order.archived_at ? "Restored" : "Archived")}
                className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-secondary">
                {order.archived_at ? <><ArchiveRestore className="size-3.5" /> Restore</> : <><Archive className="size-3.5" /> Archive</>}
              </button>
            )}
          </div>
          {open && (
            <button disabled={!!busy} onClick={() => {
              const paid = order.payment_method === "momo" && !!order.paid_at;
              const reason = prompt(paid ? `Cancel and REFUND ${formatRwf(order.paid_amount_rwf)} to the customer? Reason:` : "Cancel this order? Reason:");
              if (reason === null) return;
              run("cancel", async () => {
                const r = await cancel({ data: { order_id: order.id, reason } });
                if (r.refund === "failed") toast.error(`Cancelled, but the refund was rejected (${"code" in r ? r.code : ""}).`);
                else toast.success(r.refund === "pending" ? "Cancelled. Refund sent." : "Cancelled. Stock returned.");
              });
            }} className="text-sm text-destructive hover:underline">Cancel order…</button>
          )}
        </div>
      </aside>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{children}</p>;
}
