import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatRwf } from "@/lib/currency";
import { fetchOverview } from "@/lib/analytics";

export const Route = createFileRoute("/admin/analytics")({ component: Analytics });

const PERIODS = [7, 30, 90];

function Analytics() {
  const [days, setDays] = useState(30);
  const { data: o, isLoading } = useQuery({ queryKey: ["overview", days], queryFn: () => fetchOverview(days) });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">Analytics</h1>
          <p className="text-sm text-muted-foreground">Paid orders only. Refunded orders are not counted as sales.</p>
        </div>
        <div className="flex rounded-md bg-secondary p-0.5">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setDays(p)}
              className={`rounded px-3 py-1 font-mono text-xs ${days === p ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{p}d</button>
          ))}
        </div>
      </div>

      {isLoading || !o ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sales" value={formatRwf(o.period.revenue)} />
            <Stat label="Paid orders" value={String(o.period.paid_orders)} />
            <Stat label="Average order" value={formatRwf(o.period.avg_order)} />
            <Stat label="Customers" value={String(o.period.customers)} />
          </div>

          <section className="rounded-lg border border-border p-4">
            <h2 className="mb-4 text-sm font-medium">Sales per day (RWF)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={o.daily}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tick={{ fontSize: 11 }} width={40} />
                  <Tooltip formatter={(v: number) => formatRwf(v)} labelFormatter={(d: string) => d} />
                  <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-border">
              <h2 className="border-b border-border px-4 py-3 text-sm font-medium">Top products</h2>
              {o.top_products.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No sales in this period.</p> : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {o.top_products.map((p) => (
                      <tr key={p.name}><td className="px-4 py-2.5">{p.name}</td><td className="px-4 py-2.5 text-right font-mono">{p.units}×</td><td className="px-4 py-2.5 text-right font-mono">{formatRwf(p.revenue)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section className="rounded-lg border border-border">
              <h2 className="border-b border-border px-4 py-3 text-sm font-medium">Orders by status (placed in period)</h2>
              <ul className="divide-y divide-border text-sm">
                {Object.entries(o.status_counts).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                  <li key={s} className="flex justify-between px-4 py-2.5"><span className="capitalize">{s}</span><span className="font-mono">{n}</span></li>
                ))}
                {Object.keys(o.status_counts).length === 0 && <li className="p-6 text-muted-foreground">No orders in this period.</li>}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl">{value}</p>
    </div>
  );
}
