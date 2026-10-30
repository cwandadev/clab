import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { Sheet } from "@/components/Sheet";
import { ProductImage } from "@/components/ProductImage";
import { useStore } from "@/lib/store";
import { productsQO, type CatalogProduct } from "@/lib/catalog";
import { useMediaQuery } from "@/lib/useMediaQuery";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "tieflab, CLab — BUY Electronics, Arduino, LEDs & Creative Hardware" },
      { name: "description", content: "Shop Arduino, Raspberry Pi, LEDs, resistors, soldering tools, futuristic bulbs and creative DIY electronics from tieflab in Kigali. Pay with MTN MoMo or Airtel Money." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQO),
  component: Index,
  pendingComponent: () => (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">Could not load products: {(error as Error).message}</div>
  ),
});

type Sort = "featured" | "newest" | "price-asc" | "price-desc";
type Filters = { category: string | null; voltage: string[]; inStock: boolean; sort: Sort; min: number | null; max: number | null };
const DEFAULT: Filters = { category: null, voltage: [], inStock: false, sort: "featured", min: null, max: null };
const SORTS: { id: Sort; label: string }[] = [
  { id: "featured", label: "Featured" }, { id: "newest", label: "Newest" },
  { id: "price-asc", label: "Price: low to high" }, { id: "price-desc", label: "Price: high to low" },
];
const VOLTAGES = ["3.3V", "5.0V", "12.0V"];
const AUTO_CHUNK = 48;           // Baymard: lazy-load to ~50 products, then ask
// Snapshot taken when a product is opened; Back restores filters, how many were shown and the scroll spot.
// Kept in memory (not storage) so a fresh visit or reload starts clean and SSR never sees it.
type Snapshot = { f: Filters; shown: number; autoUntil: number; y: number };
let lastView: Snapshot | null = null;

function applyFilters(products: CatalogProduct[], f: Filters) {
  let list = products.filter((p) =>
    (!f.category || p.category === f.category) &&
    (!f.inStock || p.stock > 0) &&
    (f.min == null || p.price_rwf >= f.min) && (f.max == null || p.price_rwf <= f.max) &&
    (f.voltage.length === 0 || f.voltage.some((v) => `${p.spec_1 ?? ""} ${p.spec_2 ?? ""}`.includes(v))));
  if (f.sort === "newest") list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  else if (f.sort === "price-asc") list = [...list].sort((a, b) => a.price_rwf - b.price_rwf);
  else if (f.sort === "price-desc") list = [...list].sort((a, b) => b.price_rwf - a.price_rwf);
  else list = [...list].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0)); // featured: sold out last
  return list;
}

function Index() {
  const { data: products } = useSuspenseQuery(productsQO);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const batch = desktop ? 24 : 12;

  const [snap] = useState(() => lastView);
  const [f, setF] = useState<Filters>(snap?.f ?? DEFAULT);
  const [shown, setShown] = useState(snap?.shown ?? 12);
  const [autoUntil, setAutoUntil] = useState(snap?.autoUntil ?? AUTO_CHUNK);
  const [filterOpen, setFilterOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);
  const list = useMemo(() => applyFilters(products, f), [products, f]);
  const visible = list.slice(0, shown);
  const remaining = list.length - visible.length;
  const activeFilters = f.voltage.length + (f.inStock ? 1 : 0) + (f.sort !== "featured" ? 1 : 0) + (f.min != null || f.max != null ? 1 : 0);
  const { recentlyViewed } = useStore();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const recent = recentlyViewed.map((id) => byId.get(id)).filter((p): p is CatalogProduct => !!p).slice(0, 10);

  // Restore after Back (Baymard: "Load more" is only OK if Back returns you to the same spot).
  // The router may also reset scroll after mount, so retry for a moment unless the user scrolls first.
  useEffect(() => {
    if (!snap) return;
    lastView = null;
    let touched = false;
    const stop = () => { touched = true; };
    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchstart", stop, { passive: true, once: true });
    const timers = [0, 60, 150, 300, 600, 1000].map((ms) => setTimeout(() => { if (!touched) window.scrollTo(0, snap.y); }, ms));
    return () => { timers.forEach(clearTimeout); window.removeEventListener("wheel", stop); window.removeEventListener("touchstart", stop); };
  }, [snap]);

  // desktop starts with a bigger first batch
  useEffect(() => { setShown((n) => Math.max(n, batch)); }, [batch]);

  // Lazy-load the next batch near the bottom, until the auto limit; then the button takes over.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || remaining <= 0 || shown >= autoUntil) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setShown((n) => Math.min(n + batch, autoUntil)); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [remaining, shown, autoUntil, batch]);

  function update(next: Partial<Filters>) {
    setF((cur) => ({ ...cur, ...next }));
    setShown(batch);
    setAutoUntil(AUTO_CHUNK);
  }

  const filterControls = (id: string) => (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Sort</h2>
        <div className="space-y-1">
          {SORTS.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
              <input type="radio" name={`sort-${id}`} checked={f.sort === s.id} onChange={() => update({ sort: s.id })} className="size-4" />{s.label}
            </label>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Voltage</h2>
        {VOLTAGES.map((v) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={f.voltage.includes(v)} className="size-4 rounded"
              onChange={(e) => update({ voltage: e.target.checked ? [...f.voltage, v] : f.voltage.filter((x) => x !== v) })} />{v}
          </label>
        ))}
      </section>
      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Price (RWF)</h2>
        <div className="flex items-center gap-2">
          <input type="number" inputMode="numeric" min={0} placeholder="Min" aria-label="Minimum price" value={f.min ?? ""}
            onChange={(e) => update({ min: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm" />
          <span className="text-muted-foreground">–</span>
          <input type="number" inputMode="numeric" min={0} placeholder="Max" aria-label="Maximum price" value={f.max ?? ""}
            onChange={(e) => update({ max: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-sm" />
        </div>
      </section>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={f.inStock} onChange={(e) => update({ inStock: e.target.checked })} className="size-4 rounded" />
        In stock only
      </label>
    </div>
  );

  const chip = (on: boolean) => `inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary"}`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8"
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest('a[href^="/products/"]')) lastView = { f, shown, autoUntil, y: window.scrollY };
        }}>
        <header className="mb-5">
          <h1 className="text-xl font-medium leading-tight tracking-tight text-balance sm:text-2xl">Electronic Components & Creative DIY Hardware</h1>
          <p className="mt-1.5 max-w-[56ch] text-sm text-muted-foreground text-pretty">
            LEDs, microcontrollers, lab tools, futuristic lighting and acrylic creations — delivered in Kigali.
          </p>
        </header>

        {recent.length > 0 && (
          <section className="mb-6" aria-label="Recently viewed">
            <h2 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Continue browsing</h2>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6">
              {recent.map((p) => (
                <Link key={p.id} to="/products/$slug" params={{ slug: p.slug }} title={p.name}
                  className="flex w-56 shrink-0 items-center gap-2 rounded-lg border border-border p-1.5 pr-3 hover:bg-secondary/60">
                  <div className="size-11 shrink-0 overflow-hidden rounded-md"><ProductImage src={p.image_url} alt="" category={p.category} sizes="44px" /></div>
                  <span className="line-clamp-2 text-xs leading-snug">{p.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex gap-8">
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-20 space-y-6">
              <section>
                <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Category</h2>
                <ul className="space-y-1">
                  <li><button onClick={() => update({ category: null })} className={`flex w-full justify-between rounded px-2 py-1 text-sm ${!f.category ? "bg-secondary font-medium" : "hover:bg-secondary/60"}`}><span>All</span><span className="font-mono text-muted-foreground">{products.length}</span></button></li>
                  {categories.map(([c, n]) => (
                    <li key={c}><button onClick={() => update({ category: c })} className={`flex w-full justify-between rounded px-2 py-1 text-sm ${f.category === c ? "bg-secondary font-medium" : "hover:bg-secondary/60"}`}><span>{c}</span><span className="font-mono text-muted-foreground">{n}</span></button></li>
                  ))}
                </ul>
              </section>
              {filterControls("side")}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {/* phones and tablets: category chips + filter sheet */}
            <div className="-mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:hidden">
              <button onClick={() => setFilterOpen(true)} className={`${chip(activeFilters > 0)} inline-flex items-center gap-1.5`}>
                <SlidersHorizontal className="size-3.5" />Filter{activeFilters > 0 && ` · ${activeFilters}`}
              </button>
              <button onClick={() => update({ category: null })} className={chip(!f.category)}>All</button>
              {categories.map(([c]) => <button key={c} onClick={() => update({ category: c })} className={chip(f.category === c)}>{c}</button>)}
            </div>

            <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{list.length} {list.length === 1 ? "product" : "products"}</span>
              {activeFilters > 0 && <button onClick={() => update({ voltage: [], inStock: false, sort: "featured", min: null, max: null })} className="underline">Clear filters</button>}
            </div>

            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No products match these filters.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                  {visible.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} />)}
                </div>
                <div ref={sentinel} aria-hidden />
                {remaining > 0 && (
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <p className="text-xs text-muted-foreground">Showing {visible.length} of {list.length}</p>
                    {shown >= autoUntil && (
                      <button onClick={() => { setShown((n) => n + batch); setAutoUntil((a) => a + AUTO_CHUNK); }}
                        className="rounded-full border border-foreground px-6 py-2.5 text-sm font-medium hover:bg-foreground hover:text-background">
                        Load more ({remaining} left)
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />

      <Sheet open={filterOpen} onOpenChange={setFilterOpen} title="Sort & filter" side="bottom"
        footer={<button onClick={() => setFilterOpen(false)} className="w-full rounded-md bg-foreground py-3 text-sm font-medium text-background">Show {list.length} {list.length === 1 ? "product" : "products"}</button>}>
        <div className="pb-4">{filterControls("sheet")}</div>
      </Sheet>
    </div>
  );
}
