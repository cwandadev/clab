export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600", paid: "bg-emerald-500/10 text-emerald-600",
    processing: "bg-blue-500/10 text-blue-600", shipped: "bg-indigo-500/10 text-indigo-600",
    delivered: "bg-emerald-500/15 text-emerald-700", cancelled: "bg-muted text-muted-foreground",
    expired: "bg-muted text-muted-foreground", failed: "bg-destructive/10 text-destructive",
  };
  const label: Record<string, string> = { pending: "Awaiting payment", expired: "Expired" };
  return <span className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider ${tone[status] ?? "bg-muted"}`}>{label[status] ?? status}</span>;
}
