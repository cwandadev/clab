import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, ArrowLeft, ArrowRight, X, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resizeImage } from "@/lib/image";

/**
 * Product photos: drop, pick or take a photo. Each is shrunk in the browser (max 1200 px, WebP)
 * and stored in the public product-images bucket. The first photo is the main one.
 */
export function ImageUploader({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 12);
    if (!list.length) return;
    setBusy((n) => n + list.length);
    const added: string[] = [];
    for (const file of list) {
      try {
        const { blob, ext } = await resizeImage(file, { max: 1200, quality: 0.82 });
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("product-images")
          .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (error) throw error;
        added.push(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (added.length) onChange([...urls, ...added]);
  }

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= urls.length) return;
    const next = [...urls]; [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${over ? "border-accent bg-accent/5" : "border-border hover:bg-secondary/50"}`}>
        {busy > 0 ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : <ImagePlus className="size-6 text-muted-foreground" />}
        <span>{busy > 0 ? `Uploading ${busy}…` : "Drop photos here, or tap to choose / take a photo"}</span>
        <span className="text-xs text-muted-foreground">Resized to 1200 px WebP before upload. First photo is the main one.</span>
        <input ref={input} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {urls.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {urls.map((u, i) => (
            <li key={u + i} className="group relative overflow-hidden rounded-md ring-1 ring-black/10">
              <img src={u} alt="" className="aspect-square w-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-foreground px-1 font-mono text-[9px] uppercase text-background">Main</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move left" className="grid size-7 place-items-center text-white disabled:opacity-30"><ArrowLeft className="size-3.5" /></button>
                <button type="button" onClick={() => onChange(urls.filter((_, k) => k !== i))} aria-label="Remove photo" className="grid size-7 place-items-center text-white"><X className="size-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === urls.length - 1} aria-label="Move right" className="grid size-7 place-items-center text-white disabled:opacity-30"><ArrowRight className="size-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline"
        onClick={() => {
          const u = prompt("Paste an image address (https://…)");
          if (u && /^https:\/\//.test(u.trim())) onChange([...urls, u.trim()]);
        }}>
        <Link2 className="size-3" /> Add by web address instead
      </button>
    </div>
  );
}
