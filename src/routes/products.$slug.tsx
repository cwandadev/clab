import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Heart, Minus, Plus, Truck, ShieldCheck, Store, ShoppingCart } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductRail } from "@/components/ProductRail";
import { ProductReviews, useProductRating } from "@/components/ProductReviews";
import { Stars } from "@/components/Stars";
import { getProductBySlug, getProductImages } from "@/lib/products.functions";
import { productsQO } from "@/lib/catalog";
import { useStore, FREE_SHIPPING_KIGALI_RWF } from "@/lib/store";
import { formatPrice, formatRwf } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";

const productQO = (slug: string) => queryOptions({
  queryKey: ["product", slug],
  queryFn: () => getProductBySlug({ data: { slug } }),
});

export const Route = createFileRoute("/products/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productQO(params.slug)),
  head: ({ loaderData, params }) => ({
    meta: [
      { title: `${loaderData?.name ?? params.slug.replace(/-/g, " ")} — Clab` },
      { name: "description", content: loaderData?.description?.slice(0, 155) ?? `Buy ${params.slug.replace(/-/g, " ")} at Clab from tieflab.` },
      ...(loaderData?.image_url ? [{ property: "og:image", content: loaderData.image_url }] : []),
    ],
  }),
  component: ProductPage,
  errorComponent: ({ error }) => <div className="p-8 text-center text-sm text-muted-foreground">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-8 text-center text-sm text-muted-foreground">Product not found.</div>,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: product } = useSuspenseQuery(productQO(slug));
  if (!product) throw notFound();

  const { addToCart, currency, trackView, toggleWishlist, isWishlisted, recentlyViewed, cart, setCartOpen } = useStore();
  const [qty, setQty] = useState(1);
  const wished = isWishlisted(product.id);
  const inCart = cart.find((i) => i.id === product.id)?.quantity ?? 0;
  const available = product.active ? Math.max(0, product.stock - inCart) : 0;
  const soldOut = !product.active || product.stock <= 0;
  const onSale = !!product.compare_at_price_rwf && product.compare_at_price_rwf > product.price_rwf;

  useEffect(() => { trackView(product.id); setQty(1); }, [product.id, trackView]);

  const { data: extraImages = [] } = useQuery({
    queryKey: ["product-images", product.id],
    queryFn: () => getProductImages({ data: { product_id: product.id } }),
  });
  const gallery = useMemo(() => [...new Set([product.image_url, ...extraImages].filter(Boolean) as string[])], [product.image_url, extraImages]);
  const { data: rating } = useProductRating(product.id);
  const { data: all = [] } = useQuery(productsQO);
  const { data: together = [] } = useQuery({
    queryKey: ["also-bought", product.id],
    queryFn: async () => (await supabase.rpc("also_bought", { _product_id: product.id, _limit: 8 })).data ?? [],
  });

  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const alsoBought = together.map((t) => byId.get(t.product_id)).filter((p): p is NonNullable<typeof p> => !!p);
  const similar = all.filter((p) => p.id !== product.id && p.category === product.category && !alsoBought.some((a) => a.id === p.id)).slice(0, 8);
  const recent = recentlyViewed.filter((id) => id !== product.id).map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p).slice(0, 8);

  function add(openCart = false) {
    if (qty > available) { toast.error(available ? `Only ${available} more available` : "No more in stock"); return; }
    addToCart({ id: product!.id, slug: product!.slug, name: product!.name, price_rwf: product!.price_rwf, image_url: product!.image_url }, qty);
    if (openCart) setCartOpen(true);
    else toast.success(`Added ${qty} × ${product!.name}`, { action: { label: "View cart", onClick: () => setCartOpen(true) } });
  }

  const priceBlock = (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-2xl sm:text-3xl" data-no-translate>{formatPrice(product.price_rwf, currency)}</span>
      {onSale && <span className="font-mono text-sm text-muted-foreground line-through">{formatPrice(product.compare_at_price_rwf!, currency)}</span>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main" className="mx-auto max-w-7xl px-4 pb-32 pt-4 sm:px-6 sm:pt-8 md:pb-16">
        <nav aria-label="Breadcrumb" className="mb-4 flex gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Shop</Link><span>/</span><span className="truncate">{product.category}</span>
        </nav>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10 lg:gap-14">
          <div className="md:sticky md:top-20 md:self-start">
            <ProductGallery images={gallery} alt={product.name} category={product.category} />
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-accent">{product.category}</p>
            <h1 className="text-2xl font-medium leading-tight tracking-tight text-balance sm:text-3xl">{product.name}</h1>
            {rating && rating.count && rating.count > 0 ? (
              <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm">
                <Stars value={Number(rating.average)} /><span className="text-muted-foreground">{Number(rating.average).toFixed(1)} · {rating.count} review{rating.count > 1 ? "s" : ""}</span>
              </a>
            ) : null}
            <div className="mt-4">{priceBlock}</div>
            {currency !== "RWF" && <p className="mt-1 text-xs text-muted-foreground">Charged as {formatRwf(product.price_rwf)}</p>}

            <p className={`mt-3 text-sm ${soldOut ? "text-destructive" : product.stock <= product.low_stock_threshold ? "text-amber-700" : "text-emerald-700"}`}>
              {!product.active ? "No longer sold" : soldOut ? "Sold out" : product.stock <= product.low_stock_threshold ? `Only ${product.stock} left` : "In stock"}
            </p>

            {(product.spec_1 || product.spec_2) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {[product.spec_1, product.spec_2].filter(Boolean).map((s) => (
                  <span key={s} className="rounded bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground ring-1 ring-black/5">{s}</span>
                ))}
              </div>
            )}

            {/* desktop / tablet buy box — phones use the sticky bar below */}
            <div className="mt-6 hidden items-center gap-3 md:flex">
              <QtyStepper qty={qty} setQty={setQty} max={Math.max(1, available)} disabled={soldOut} />
              <button disabled={soldOut} onClick={() => add()} className="flex-1 rounded-md bg-foreground py-3 text-sm font-medium text-background disabled:opacity-50">
                {soldOut ? "Sold out" : "Add to cart"}
              </button>
              <button onClick={() => toggleWishlist({ id: product.id, slug: product.slug, name: product.name, price_rwf: product.price_rwf, image_url: product.image_url })}
                aria-label={wished ? "Remove from saved" : "Save for later"} aria-pressed={wished}
                className="grid size-12 place-items-center rounded-md ring-1 ring-border hover:bg-secondary">
                <Heart className={"size-5 " + (wished ? "fill-accent stroke-accent" : "")} />
              </button>
            </div>
            {inCart > 0 && <p className="mt-2 text-xs text-muted-foreground">{inCart} already in your cart · <button onClick={() => setCartOpen(true)} className="underline">view cart</button></p>}

            <ul className="mt-6 space-y-2 rounded-lg bg-secondary/50 p-4 text-sm">
              <li className="flex gap-2"><Truck className="mt-0.5 size-4 shrink-0" />Kigali delivery {formatRwf(2000)}, free from {formatRwf(FREE_SHIPPING_KIGALI_RWF)} · rest of Rwanda {formatRwf(8000)}</li>
              <li className="flex gap-2"><Store className="mt-0.5 size-4 shrink-0" />Free pickup at the tieflab shop in Kigali</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" />Pay with MTN MoMo, Airtel Money or cash</li>
            </ul>

            {product.description && (
              <div className="mt-6">
                <h2 className="mb-2 text-sm font-medium">About this product</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{product.description}</p>
              </div>
            )}
          </div>
        </div>

        <ProductReviews productId={product.id} productSlug={product.slug} />
        <ProductRail title="People also bought" products={alsoBought} />
        <ProductRail title="More in this category" products={similar} />
        <ProductRail title="Recently viewed" products={recent} />
      </main>
      <Footer />

      {/* phones: sticky buy bar (the tab bar is hidden on product pages) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <button onClick={() => toggleWishlist({ id: product.id, slug: product.slug, name: product.name, price_rwf: product.price_rwf, image_url: product.image_url })}
            aria-label={wished ? "Remove from saved" : "Save for later"} aria-pressed={wished}
            className="grid size-11 shrink-0 place-items-center rounded-md ring-1 ring-border">
            <Heart className={"size-5 " + (wished ? "fill-accent stroke-accent" : "")} />
          </button>
          <QtyStepper qty={qty} setQty={setQty} max={Math.max(1, available)} disabled={soldOut} compact />
          <button disabled={soldOut} onClick={() => add(true)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-50">
            <ShoppingCart className="size-4" />{soldOut ? "Sold out" : `Add · ${formatPrice(product.price_rwf * qty, currency)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function QtyStepper({ qty, setQty, max, disabled, compact }: { qty: number; setQty: (n: number) => void; max: number; disabled?: boolean; compact?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center rounded-md border border-input ${compact ? "h-11" : "h-12"}`}>
      <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={disabled || qty <= 1} aria-label="One less" className="grid h-full w-10 place-items-center disabled:opacity-30"><Minus className="size-4" /></button>
      <span className="w-7 text-center font-mono text-sm" aria-live="polite">{qty}</span>
      <button onClick={() => setQty(Math.min(max, qty + 1))} disabled={disabled || qty >= max} aria-label="One more" className="grid h-full w-10 place-items-center disabled:opacity-30"><Plus className="size-4" /></button>
    </div>
  );
}
