import { Link } from "@tanstack/react-router";
import { Bell, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Note = {
  id: string; kind: string; severity: string; title: string;
  body: string | null; link: string | null; read_at: string | null; created_at: string;
};

/** kind → look. An unknown kind falls back to the plain look instead of breaking. */
function iconFor(n: Note) {
  if (n.severity === "critical") return <AlertTriangle className="size-4 text-destructive" />;
  if (n.severity === "warning") return <AlertTriangle className="size-4 text-amber-500" />;
  if (n.kind.startsWith("order_paid") || n.kind === "refund_done" || n.kind === "order_delivered")
    return <CheckCircle2 className="size-4 text-emerald-500" />;
  return <Info className="size-4 text-muted-foreground" />;
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

export function NotificationBell({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => { if (alive && data) setNotes(data as Note[]); });

    const channel = supabase
      .channel(`notes-${userId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => setNotes((prev) => [payload.new as Note, ...prev].slice(0, 30)))
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const unread = notes.filter((n) => !n.read_at).length;

  async function markAllRead() {
    const ids = notes.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    setNotes((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase.from("notifications").update({ read_at: now }).in("id", ids);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[9px] text-accent-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 z-50 sm:w-96 rounded-lg border border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent hover:underline">Mark all read</button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {notes.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet.</li>}
            {notes.map((n) => {
              const inner = (
                <div className={`flex gap-3 px-4 py-3 ${n.read_at ? "" : "bg-accent/5"}`}>
                  <div className="mt-0.5">{iconFor(n)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <a href={n.link} onClick={() => setOpen(false)} className="block hover:bg-secondary/60">{inner}</a>
                  ) : inner}
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border px-4 py-2 text-right">
            <Link to="/account" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
              My account →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
