import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Camera, Loader2, BadgeCheck, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { resizeImage } from "@/lib/image";
import { Stars, StarInput } from "./Stars";
import { UserAvatar } from "./UserAvatar";

export function useProductRating(productId: string) {
  return useQuery({
    queryKey: ["rating", productId],
    queryFn: async () => (await supabase.from("product_ratings").select("average, count").eq("product_id", productId).maybeSingle()).data,
  });
}

export function ProductReviews({ productId, productSlug }: { productId: string; productSlug: string }) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [sort, setSort] = useState<"helpful" | "newest">("helpful");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", productId, user?.id ?? "anon"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("product_reviews", { _product_id: productId });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: canReview = false } = useQuery({
    queryKey: ["can-review", productId, user?.id],
    enabled: !!user,
    queryFn: async () => !!(await supabase.rpc("has_received_product", { _user: user!.id, _product: productId })).data,
  });

  const mine = reviews.find((r) => r.is_mine);
  const sorted = useMemo(() => sort === "newest" ? [...reviews].sort((a, b) => b.created_at.localeCompare(a.created_at)) : reviews, [reviews, sort]);
  const shown = showAll ? sorted : sorted.slice(0, 5);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));
  const refresh = () => { qc.invalidateQueries({ queryKey: ["reviews", productId] }); qc.invalidateQueries({ queryKey: ["rating", productId] }); };

  async function vote(reviewId: string, current: number | null, v: 1 | -1) {
    if (!user) { toast.message("Sign in to vote on reviews."); return; }
    const res = current === v
      ? await supabase.from("review_votes").delete().eq("review_id", reviewId).eq("user_id", user.id)
      : await supabase.from("review_votes").upsert({ review_id: reviewId, user_id: user.id, vote_type: v }, { onConflict: "review_id,user_id" });
    if (res.error) toast.error(res.error.message); else refresh();
  }

  async function remove() {
    if (!mine || !confirm("Delete your review?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", mine.id);
    if (error) toast.error(error.message); else { toast.success("Review deleted"); refresh(); }
  }

  return (
    <section id="reviews" className="mt-14 scroll-mt-20">
      <h2 className="mb-5 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">Reviews</h2>
      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <div>
          {reviews.length > 0 ? (
            <>
              <p className="flex items-baseline gap-2"><span className="text-4xl font-medium">{avg.toFixed(1)}</span><span className="text-sm text-muted-foreground">out of 5</span></p>
              <Stars value={avg} size={18} className="mt-1" />
              <p className="mt-1 text-xs text-muted-foreground">{reviews.length} review{reviews.length > 1 ? "s" : ""} from verified buyers</p>
              <ul className="mt-4 space-y-1.5">
                {dist.map(({ n, c }) => (
                  <li key={n} className="flex items-center gap-2 text-xs">
                    <span className="w-3 font-mono">{n}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${reviews.length ? (c / reviews.length) * 100 : 0}%` }} /></span>
                    <span className="w-6 text-right font-mono text-muted-foreground">{c}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : !isLoading && <p className="text-sm text-muted-foreground">No reviews yet.</p>}

          <div className="mt-5">
            {!user ? (
              <p className="text-xs text-muted-foreground"><Link to="/auth" search={{ redirect: `/products/${productSlug}` } as never} className="underline">Sign in</Link> to review a product you received.</p>
            ) : mine && !editing ? (
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-secondary"><Pencil className="size-3.5" />Edit my review</button>
                <button onClick={remove} aria-label="Delete my review" className="grid size-9 place-items-center rounded-md border border-input text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
              </div>
            ) : canReview || editing ? (
              <ReviewForm productId={productId} existing={mine ?? null} onDone={() => { setEditing(false); refresh(); }} />
            ) : (
              <p className="text-xs text-muted-foreground">Only customers who received this product can review it.</p>
            )}
          </div>
        </div>

        <div>
          {reviews.length > 1 && (
            <div className="mb-3 flex gap-1 text-xs">
              {(["helpful", "newest"] as const).map((s) => (
                <button key={s} onClick={() => setSort(s)} className={`rounded-full px-3 py-1 ${sort === s ? "bg-foreground text-background" : "bg-secondary"}`}>{s === "helpful" ? "Most helpful" : "Newest"}</button>
              ))}
            </div>
          )}
          <ul className="divide-y divide-border">
            {shown.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex items-center gap-2">
                  <UserAvatar name={r.author} url={r.author_avatar} size={28} />
                  <span className="text-sm font-medium">{r.author}</span>
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-600"><BadgeCheck className="size-3.5" />Verified buyer</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2"><Stars value={r.rating} /><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span></div>
                {r.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.comment}</p>}
                {r.photo_url && <a href={r.photo_url} target="_blank" rel="noreferrer"><img src={r.photo_url} alt="Customer photo" loading="lazy" className="mt-3 size-24 rounded-md object-cover" /></a>}
                {!r.is_mine && (
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Helpful?</span>
                    <button onClick={() => vote(r.id, r.my_vote, 1)} aria-pressed={r.my_vote === 1} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${r.my_vote === 1 ? "bg-foreground text-background" : "hover:bg-secondary"}`}><ThumbsUp className="size-3.5" />{r.upvotes}</button>
                    <button onClick={() => vote(r.id, r.my_vote, -1)} aria-pressed={r.my_vote === -1} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${r.my_vote === -1 ? "bg-foreground text-background" : "hover:bg-secondary"}`}><ThumbsDown className="size-3.5" />{r.downvotes}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!showAll && sorted.length > 5 && (
            <button onClick={() => setShowAll(true)} className="mt-2 rounded-full border border-foreground px-5 py-2 text-sm">Show all {sorted.length} reviews</button>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewForm({ productId, existing, onDone }: {
  productId: string;
  existing: { id: string; rating: number; comment: string | null; photo_url: string | null } | null;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [photo, setPhoto] = useState<string | null>(existing?.photo_url ?? null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in first.");
      const { blob, ext } = await resizeImage(file, { max: 1200 });
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;   // first folder = your id (storage rule)
      const { error } = await supabase.storage.from("review-photos").upload(path, blob, { contentType: blob.type });
      if (error) throw error;
      setPhoto(supabase.storage.from("review-photos").getPublicUrl(path).data.publicUrl);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function submit() {
    if (rating < 1) { toast.error("Choose 1 to 5 stars."); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const row = { rating, comment: comment.trim() || null, photo_url: photo, updated_at: new Date().toISOString() };
    const res = existing
      ? await supabase.from("reviews").update(row).eq("id", existing.id)
      : await supabase.from("reviews").insert({ ...row, user_id: user!.id, product_id: productId });
    setBusy(false);
    if (res.error) toast.error(res.error.message.includes("row-level security") ? "Only customers who received this product can review it." : res.error.message);
    else { toast.success("Thanks for your review!"); onDone(); }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">{existing ? "Edit your review" : "Write a review"}</p>
      <StarInput value={rating} onChange={setRating} />
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={4}
        placeholder="What did you build with it? How was the quality?" aria-label="Your review"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      <div className="flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-2 text-xs hover:bg-secondary">
          <Camera className="size-3.5" />{photo ? "Change photo" : "Add photo"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {photo && <><img src={photo} alt="" className="size-10 rounded object-cover" /><button onClick={() => setPhoto(null)} className="text-xs underline">remove</button></>}
      </div>
      <button onClick={submit} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-foreground py-2.5 text-sm font-medium text-background disabled:opacity-60">
        {busy && <Loader2 className="size-4 animate-spin" />}{existing ? "Save" : "Post review"}
      </button>
    </div>
  );
}
