// src/components/ProductCard.tsx
import { Link } from "@tanstack/react-router";
import { Heart, Plus, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { formatPrice } from "@/lib/currency";
import { ProductImage } from "./ProductImage";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_rwf: number;
  compare_at_price_rwf?: number | null;
  image_url: string | null;
  spec_1: string | null;
  spec_2: string | null;
  stock: number;
  low_stock_threshold?: number | null;
  category?: string | null;
  product_type?: string | null;
};

/** Compact card: 2 per row on phones, up to 4 on desktop. */
export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const { addToCart, currency, toggleWishlist, isWishlisted, setCartOpen, cart } = useStore();
  const [justAdded, setJustAdded] = useState(false);
  const wished = isWishlisted(product.id);
  const inCart = cart.find((i) => i.id === product.id)?.quantity ?? 0;
  const soldOut = product.stock <= 0;
  const low = !soldOut && product.stock <= (product.low_stock_threshold ?? 5);
  const onSale = !!product.compare_at_price_rwf && product.compare_at_price_rwf > product.price_rwf;

  function quickAdd() {
    if (inCart >= product.stock) { toast.error(`Only ${product.stock} in stock`); return; }
    addToCart({ id: product.id, slug: product.slug, name: product.name, price_rwf: product.price_rwf, image_url: product.image_url }, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
    toast.success(`${product.name} added`, { action: { label: "View cart", onClick: () => setCartOpen(true) } });
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-shadow hover:shadow-md">
      <Link to="/products/$slug" params={{ slug: product.slug }} className="relative block" aria-label={product.name}>
        <ProductImage src={product.image_url} alt={product.name} category={product.category} eager={priority}
          sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 28vw, (min-width: 640px) 31vw, 48vw" />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {soldOut && <span className="rounded bg-foreground/90 px-1.5 py-0.5 font-mono text-[10px] uppercase text-background">Sold out</span>}
          {low && <span className="rounded bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] uppercase text-white">Only {product.stock} left</span>}
          {onSale && !soldOut && <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] uppercase text-accent-foreground">Sale</span>}
        </div>
      </Link>

      <button
        onClick={() => toggleWishlist({ id: product.id, slug: product.slug, name: product.name, price_rwf: product.price_rwf, image_url: product.image_url })}
        aria-label={wished ? "Remove from saved" : "Save for later"} aria-pressed={wished}
        className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-background/90 ring-1 ring-black/5 backdrop-blur transition hover:bg-background">
        <Heart className={"size-4 " + (wished ? "fill-accent stroke-accent" : "stroke-muted-foreground")} />
      </button>

      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <Link to="/products/$slug" params={{ slug: product.slug }} className="line-clamp-2 text-[13px] font-medium leading-snug hover:text-accent sm:text-sm">
          {product.name}
        </Link>
        {(product.spec_1 || product.spec_2) && (
          <p className="truncate font-mono text-[10px] text-muted-foreground">{[product.spec_1, product.spec_2].filter(Boolean).join(" · ")}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            <p className="font-mono text-sm font-medium" data-no-translate>{formatPrice(product.price_rwf, currency)}</p>
            {onSale && <p className="font-mono text-[11px] text-muted-foreground line-through">{formatPrice(product.compare_at_price_rwf!, currency)}</p>}
          </div>
          <button onClick={quickAdd} disabled={soldOut}
            aria-label={soldOut ? "Sold out" : `Add ${product.name} to cart`}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background transition active:scale-95 disabled:bg-secondary disabled:text-muted-foreground">
            {justAdded ? <Check className="size-4" /> : <Plus className="size-4" />}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border" aria-hidden>
      <div className="aspect-square animate-pulse bg-secondary" />
      <div className="space-y-2 p-3 sm:p-4">
        <div className="h-3 w-4/5 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
        <div className="flex justify-between pt-2"><div className="h-4 w-16 animate-pulse rounded bg-secondary" /><div className="size-9 animate-pulse rounded-full bg-secondary" /></div>
      </div>
    </div>
  );
}
