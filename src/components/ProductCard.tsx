import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useStore, isComponentProduct } from "@/lib/store";
import { formatPrice } from "@/lib/currency";
import { toast } from "sonner";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_usd: number;
  image_url: string | null;
  spec_1: string | null;
  spec_2: string | null;
  stock: number;
  category?: string | null;
  product_type?: string | null;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const { addToCart, currency, toggleWishlist, isWishlisted, recentlyViewed } = useStore();
  const wished = isWishlisted(product.id);
  const recent = recentlyViewed.includes(product.id);
  const isKit = isComponentProduct(product);
  const buttonLabel = isKit ? "Add to Kit" : "Add to Cart";

  return (
    <div className="relative flex flex-col bg-background p-6 group">
      {recent && (
        <span className="absolute top-3 left-3 z-10 rounded bg-foreground px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-background">
          Recently viewed
        </span>
      )}
      <button
        onClick={(e) => {
          e.preventDefault();
          toggleWishlist({
            id: product.id, slug: product.slug, name: product.name,
            price_usd: product.price_usd, image_url: product.image_url,
          });
        }}
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        className="absolute top-3 right-3 z-10 grid size-8 place-items-center rounded-full bg-background/90 ring-1 ring-black/5 backdrop-blur transition hover:bg-background"
      >
        <Heart className={"size-4 " + (wished ? "fill-accent stroke-accent" : "stroke-muted-foreground")} />
      </button>

      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        className="mb-6 grid aspect-square w-full place-items-center rounded-[min(1vw,12px)] bg-secondary outline-1 -outline-offset-1 outline-black/5 overflow-hidden"
      >
        {product.image_url ? (
          <img src={product.image_url} alt={product.name}
            className="size-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {product.slug.slice(0, 12)}
          </span>
        )}
      </Link>
      <div className="flex-1">
        <div className="mb-1 flex justify-between items-start gap-3">
          <Link to="/products/$slug" params={{ slug: product.slug }}
            className="text-sm font-medium hover:text-accent">
            {product.name}
          </Link>
          <span className="font-mono text-sm whitespace-nowrap" data-no-translate>
            {formatPrice(product.price_usd, currency)}
          </span>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {product.spec_1 && (
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-black/5">{product.spec_1}</span>
          )}
          {product.spec_2 && (
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-black/5">{product.spec_2}</span>
          )}
        </div>
        {product.description && (
          <p className="mb-6 text-sm text-muted-foreground text-pretty leading-relaxed line-clamp-2">
            {product.description}
          </p>
        )}
      </div>
      <button
        onClick={() => {
          addToCart({
            id: product.id, slug: product.slug, name: product.name,
            price_usd: product.price_usd, image_url: product.image_url,
          }, 1);
          toast.success(`${product.name} ${isKit ? "added to kit" : "added to cart"}`);
        }}
        disabled={product.stock === 0}
        className="w-full rounded bg-secondary px-3 py-2 text-sm font-medium ring-1 ring-black/5 transition-colors hover:bg-foreground hover:text-background disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {product.stock === 0 ? "Out of stock" : buttonLabel}
      </button>
    </div>
  );
}
