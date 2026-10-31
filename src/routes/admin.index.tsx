import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PackageCheck, Truck, Smartphone, MessageSquare, AlertTriangle, PackageX, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRwf } from "@/lib/currency";
import { fetchOverview } from "@/lib/analytics";
import { StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/admin/")({ component: AdminOverview });

function AdminOverview() {
  const { data: o } = useQuery({ queryKey: ["overview", 7], queryFn: () => fetchOverview(7), refetchInterval: 30000 });
  const { data: recent = [] } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => (await supabase.from("orders").select("id, order_code, customer_name, total_rwf, status, created_at")
      .is("archived_at", null).order("created_at", { ascending: false }).limit(8)).data ?? [],
    refetchInterval: 30000,
  });
  const { data: low = [] } = useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, stock, low_stock_threshold").eq("active", true).order("stock").limit(30);
      return (data ?? []).filter((p) => p.stock <= p.low_stock_threshold).slice(0, 8);
    },
  });

  const a = o?.action;
  const cards = [
    { label: "To dispatch", value: a?.to_dispatch, icon: PackageCheck, to: "/admin/orders", hot: true },
    { label: "Packing / on the way", value: a?.processing, icon: Truck, to: "/admin/orders" },
    { label: "Awaiting payment", value: a?.awaiting_payment, icon: Smartphone, to: "/admin/orders" },
    { label: "Chats waiting", value: a?.chats_waiting, icon: MessageSquare, to: "/admin/chats", hot: true },
    { label: "Refunds pending", value: a?.refunds_pending, icon: Undo2, to: "/admin/orders", hot: true },
    { label: "Running low", value: a?.low_stock, icon: AlertTriangle, to: "/admin/products" },
    { label: "Out of stock", value: a?.out_of_stock, icon: PackageX, to: "/admin/products", hot: true },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Overview</h1>
          <p className="text-sm text-muted-foreground">What needs doing now.</p>
        </div>
        <div className="flex gap-6 font-mono text-sm">
          <div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Orders today</p><p className="text-lg">{o?.today.orders ?? "—"}</p></div>
          <div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sales today</p><p className="text-lg">{o ? formatRwf(o.today.revenue) : "—"}</p></div>
          <div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Last 7 days</p><p className="text-lg">{o ? formatRwf(o.period.revenue) : "—"}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className={`rounded-lg border p-4 transition-colors hover:bg-secondary/60 ${c.hot && (c.value ?? 0) > 0 ? "border-accent/50 bg-accent/5" : "border-border"}`}>
            <c.icon className="size-4 text-muted-foreground" />
            <p className="mt-3 font-mono text-2xl">{c.value ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">Latest orders</h2>
            <Link to="/admin/orders" className="text-xs text-muted-foreground hover:text-foreground">All orders →</Link>
          </div>
          {recent.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No orders yet.</p> : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id}>
                  <a href={`/admin/orders?o=${r.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-secondary/50">
                    <span className="font-mono">{r.order_code}</span>
                    <span className="flex-1 truncate text-muted-foreground">{r.customer_name}</span>
                    <span className="font-mono">{formatRwf(r.total_rwf)}</span>
                    <StatusPill status={r.status} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-medium">Stock needing attention</h2></div>
          {low.length === 0 ? <p className="p-6 text-sm text-muted-foreground">All stocked.</p> : (
            <ul className="divide-y divide-border">
              {low.map((p) => (
                <li key={p.id}>
                  <Link to="/admin/products/edit/$id" params={{ id: p.id }} className="flex justify-between px-4 py-2.5 text-sm hover:bg-secondary/50">
                    <span className="truncate">{p.name}</span>
                    <span className={`font-mono ${p.stock === 0 ? "text-destructive" : "text-amber-700"}`}>{p.stock}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
