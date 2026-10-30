import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Msg = { id: string; user_id: string; message: string; is_from_admin: boolean; attachment_path: string | null; created_at: string };

/** Files live in the PRIVATE chat-attachments bucket; links are signed for 1 hour. */
function Attachment({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("chat-attachments").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  const name = path.split("/").pop();
  if (!url) return <span className="text-xs opacity-70">{name}</span>;
  return /\.(png|jpe?g|webp)$/i.test(path)
    ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={name} className="mt-2 max-h-48 rounded" /></a>
    : <a href={url} target="_blank" rel="noreferrer" className="mt-1 block text-xs underline break-all">{name}</a>;
}

/**
 * One support thread. threadUserId = the customer whose thread this is.
 * Customers see their own thread; admins can open any thread (RLS enforces both).
 */
export function SupportChat({ threadUserId, asAdmin, className = "h-96" }: { threadUserId: string; asAdmin: boolean; className?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    supabase.from("chat_messages").select("*").eq("user_id", threadUserId).order("created_at")
      .then(({ data }) => { if (alive) setMsgs((data ?? []) as Msg[]); });
    const ch = supabase.channel(`chat-${threadUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `user_id=eq.${threadUserId}` },
        (p) => setMsgs((prev) => prev.some((m) => m.id === (p.new as Msg).id) ? prev : [...prev, p.new as Msg]))
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [threadUserId]);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs]);

  async function send() {
    if (!text.trim() && !file) return;
    setSending(true);
    try {
      let attachment_path: string | null = null;
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Files must be under 10 MB.");
        const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-60);
        attachment_path = `${threadUserId}/${Date.now()}-${safe}`;   // first folder = the customer's id (storage rule)
        const { error } = await supabase.storage.from("chat-attachments").upload(attachment_path, file);
        if (error) throw error;
      }
      const { data, error } = await supabase.from("chat_messages")
        .insert({ user_id: threadUserId, message: text.trim() || "Sent a file", is_from_admin: asAdmin, attachment_path })
        .select().single();
      if (error) throw new Error(error.message.includes("RATE_LIMITED") ? "Slow down a little — try again in a minute." : error.message);
      setMsgs((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Msg]));
      setText(""); setFile(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={`flex flex-col rounded-md border border-border bg-background ${className}`}>
      <div ref={box} className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>}
        {msgs.map((m) => {
          const mine = m.is_from_admin === asAdmin;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-foreground text-background" : "bg-secondary"}`}>
                {!mine && <p className="mb-0.5 font-mono text-[10px] uppercase opacity-60">{m.is_from_admin ? "tieflab support" : "customer"}</p>}
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
                {m.attachment_path && <Attachment path={m.attachment_path} />}
                <p className="mt-1 text-right font-mono text-[10px] opacity-60">{new Date(m.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Write a message…" aria-label="Message"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <label className="inline-flex cursor-pointer items-center rounded-md border border-input px-3 hover:bg-secondary" aria-label="Attach a file">
            <Paperclip className="size-4" />
            <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button onClick={send} disabled={sending || (!text.trim() && !file)} aria-label="Send"
            className="inline-flex items-center rounded-md bg-foreground px-3 text-background disabled:opacity-50">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        {file && <p className="mt-1 text-xs text-muted-foreground">Attached: {file.name} <button onClick={() => setFile(null)} className="underline">remove</button></p>}
      </div>
    </div>
  );
}
