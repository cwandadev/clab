import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SupportChat } from "@/components/SupportChat";

export const Route = createFileRoute("/admin/chats")({
  head: () => ({ meta: [{ title: "Inbox — Admin — tieflab" }] }),
  component: Inbox,
});

function Inbox() {
  const [tab, setTab] = useState<"needs" | "all">("needs");
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const { data: threads = [], refetch } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_chat_threads");
      if (error) throw error;
      return [...(data ?? [])].sort((a, b) => b.last_at.localeCompare(a.last_at));
    },
  });

  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get("u");
    if (u) { setOpenId(u); setTab("all"); }
    const ch = supabase.channel("inbox").on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => refetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const shown = useMemo(() => threads
    .filter((t) => tab === "all" || t.needs_reply)
    .filter((t) => !q || [t.display_name, t.email].some((v) => v?.toLowerCase().includes(q.toLowerCase()))), [threads, tab, q]);
  const open = threads.find((t) => t.user_id === openId);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">Inbox</h1>
      <div className="grid h-[calc(100vh-10rem)] gap-4 md:grid-cols-[300px_1fr]">
        <aside className={`flex flex-col rounded-lg border border-border ${openId ? "hidden md:flex" : ""}`}>
          <div className="flex gap-1 border-b border-border p-2">
            {(["needs", "all"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 rounded px-2 py-1 text-xs ${tab === t ? "bg-secondary font-medium" : "text-muted-foreground"}`}>
                {t === "needs" ? `Needs reply (${threads.filter((x) => x.needs_reply).length})` : `All (${threads.length})`}
              </button>
            ))}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email"
            className="m-2 rounded-md border border-input px-3 py-1.5 text-sm" />
          <ul className="flex-1 divide-y divide-border overflow-y-auto">
            {shown.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{tab === "needs" ? "All caught up." : "No chats yet."}</li>}
            {shown.map((t) => (
              <li key={t.user_id}>
                <button onClick={() => setOpenId(t.user_id)}
                  className={`w-full px-3 py-2.5 text-left hover:bg-secondary/60 ${openId === t.user_id ? "bg-secondary" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{t.display_name || t.email}</span>
                    {t.needs_reply && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Needs reply" />}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{t.last_message}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{new Date(t.last_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</p>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className={`flex flex-col ${openId ? "" : "hidden md:flex"}`}>
          {open ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{open.display_name || open.email}</p>
                  <p className="text-xs text-muted-foreground">{open.email}</p>
                </div>
                <button onClick={() => setOpenId(null)} className="text-xs text-muted-foreground md:hidden">← Back</button>
              </div>
              <SupportChat key={open.user_id} threadUserId={open.user_id} asAdmin className="flex-1 min-h-0" />
            </>
          ) : (
            <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">Pick a conversation.</div>
          )}
        </section>
      </div>
    </div>
  );
}
