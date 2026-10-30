import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Clock, X } from "lucide-react";
import { Sheet } from "./Sheet";
import { ProductImage } from "./ProductImage";
import { productsQO, type CatalogProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/currency";
import { useStore } from "@/lib/store";

const RECENT_KEY = "tl_recent_searches";

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const haystack = (p: CatalogProduct) => [p.name, p.category, p.spec_1, p.spec_2, p.description].join(" ").toLowerCase();

/** Search as you type: name, category, specs and description. Recent searches; "did you mean" on typos. */
export function SearchSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { currency } = useStore();
  const { data: products = [] } = useQuery({ ...productsQO, enabled: open });
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")); } catch { setRecent([]); }
    const t = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [open]);

  function remember(term: string) {
    const t = term.trim();
    if (t.length < 2) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 8);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }
  function clearRecent() { setRecent([]); localStorage.removeItem(RECENT_KEY); }

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(() => {
    if (!words.length) return [];
    return products
      .map((p) => {
        const hay = haystack(p);
        if (!words.every((w) => hay.includes(w))) return null;
        const name = p.name.toLowerCase();
        const score = words.reduce((s, w) => s + (name.startsWith(w) ? 3 : name.includes(w) ? 2 : 1), 0) + (p.stock > 0 ? 0.5 : 0);
        return { p, score };
      })
      .filter((x): x is { p: CatalogProduct; score: number } => !!x)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30).map((x) => x.p);
  }, [q, products]);  // eslint-disable-line react-hooks/exhaustive-deps

  const suggestion = useMemo(() => {
    if (!words.length || results.length) return null;
    const vocab = [...new Set(products.flatMap((p) => `${p.name} ${p.category}`.toLowerCase().split(/[^a-z0-9.]+/)).filter((w) => w.length >= 3))];
    let changed = false;
    const fixed = words.map((w) => {
      if (vocab.some((v) => v.includes(w))) return w;
      let best = w, bestD = w.length >= 6 ? 3 : 2;
      for (const v of vocab) { const dd = editDistance(w, v); if (dd < bestD) { bestD = dd; best = v; } }
      if (best !== w) changed = true;
      return best;
    });
    return changed ? fixed.join(" ") : null;
  }, [q, results.length, products]);  // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Search" tall>
      <form className="sticky top-0 z-10 -mx-5 bg-background px-5 pb-3" onSubmit={(e) => { e.preventDefault(); remember(q); input.current?.blur(); }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search"
            placeholder="Arduino, LED, 5V, soldering…" aria-label="Search products"
            className="w-full rounded-lg border border-input bg-background py-3 pl-9 pr-3 text-base" />
        </div>
      </form>

      {!words.length && (
        <div className="space-y-6 pb-6">
          {recent.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Recent</h3>
                <button onClick={clearRecent} className="text-xs text-muted-foreground underline">Clear</button>
              </div>
              <ul>
                {recent.map((r) => (
                  <li key={r} className="flex items-center">
                    <button onClick={() => setQ(r)} className="flex flex-1 items-center gap-2 py-2 text-left text-sm"><Clock className="size-3.5 text-muted-foreground" />{r}</button>
                    <button aria-label={`Remove ${r}`} onClick={() => { const n = recent.filter((x) => x !== r); setRecent(n); localStorage.setItem(RECENT_KEY, JSON.stringify(n)); }}
                      className="grid size-8 place-items-center text-muted-foreground"><X className="size-3.5" /></button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">Browse</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => <button key={c} onClick={() => setQ(c)} className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary">{c}</button>)}
            </div>
          </section>
        </div>
      )}

      {words.length > 0 && results.length === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <p>Nothing matches “{q}”.</p>
          {suggestion ? <p className="mt-2">Did you mean <button onClick={() => setQ(suggestion)} className="font-medium text-foreground underline">{suggestion}</button>?</p>
            : <p className="mt-2">Try fewer or shorter words.</p>}
        </div>
      )}

      {results.length > 0 && <p className="pb-1 text-xs text-muted-foreground">{results.length} result{results.length > 1 ? "s" : ""}</p>}
      <ul className="divide-y divide-border pb-6">
        {results.map((p) => (
          <li key={p.id}>
            <Link to="/products/$slug" params={{ slug: p.slug }} onClick={() => { remember(q); onOpenChange(false); }} className="flex items-center gap-3 py-2.5">
              <div className="size-12 shrink-0 overflow-hidden rounded-md"><ProductImage src={p.image_url} alt={p.name} category={p.category} sizes="48px" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.category}{p.stock === 0 ? " · sold out" : ""}</p>
              </div>
              <span className="font-mono text-sm">{formatPrice(p.price_rwf, currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
