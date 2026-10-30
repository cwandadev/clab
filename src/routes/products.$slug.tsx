import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { getProductBySlug, listProducts, getProductImages } from "@/lib/products.functions";
import { useStore, isComponentProduct } from "@/lib/store";
import { formatPrice } from "@/lib/currency";

export const Route = createFileRoute("/products/$slug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["product", params.slug],
        queryFn: () => getProductBySlug({ data: { slug: params.slug } }),
      }),
    ),
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Clab` },
      { name: "description", content: `Buy ${params.slug.replace(/-/g, " ")} at Clab from tieflab.` },
    ],
  }),
  component: ProductPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">{(error as Error).message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Product not found.</div>
  ),
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: product } = useSuspenseQuery(
    queryOptions({
      queryKey: ["product", slug],
      queryFn: () => getProductBySlug({ data: { slug } }),
    }),
  );
  if (!product) throw notFound();

  const { addToCart, currency, trackView, toggleWishlist, isWishlisted } = useStore();
  const [qty, setQty] = useState(1);
  const wished = isWishlisted(product.id);
  const isKit = isComponentProduct(product as any);
  const ctaLabel = isKit ? "Add to Kit" : "Add to Cart";

  // Track recently viewed
  useEffect(() => { trackView(product.id); }, [product.id, trackView]);

  // Extra images gallery
  const { data: extraImages = [] } = useQuery({
    queryKey: ["product-images", product.id],
    queryFn: () => getProductImages({ data: { product_id: product.id } }),
  });
  const gallery = [product.image_url, ...extraImages].filter(Boolean) as string[];
  const [activeImg, setActiveImg] = useState(0);

  // Similar products (same category, exclude current)
  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  });
  const similar = (allProducts as any[])
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  function handleAddToCart() {
    addToCart({
      id: product!.id, slug: product!.slug, name: product!.name,
      price_rwf: Number(product!.price_rwf), image_url: product!.image_url,
    }, qty);
    toast.success(`Added ${qty} × ${product!.name}`);
  }

  function handleBuyNow() {
    handleAddToCart();
    setTimeout(() => { window.location.href = "/checkout"; }, 100);
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Link to="/" className="font-mono text-xs uppercase text-muted-foreground hover:text-foreground">
          ← Back to inventory
        </Link>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10 lg:gap-12">
          <div>
            <div className="aspect-square rounded-lg bg-secondary outline-1 -outline-offset-1 outline-black/5 grid place-items-center overflow-hidden">
              {gallery[activeImg] ? (
                <img src={gallery[activeImg]} alt={product.name} className="size-full object-cover" />
              ) : (
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {product.category}
                </span>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {gallery.map((src, i) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={"size-16 shrink-0 overflow-hidden rounded ring-1 " +
                      (i === activeImg ? "ring-accent ring-2" : "ring-black/5")}>
                    <img src={src} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent mb-3">
              {product.category}
            </p>
            <h1 className="text-3xl font-medium tracking-tight text-balance">{product.name}</h1>
            <p className="mt-4 text-3xl font-mono">{formatPrice(Number(product.price_rwf), currency)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {product.spec_1 && (
                <span className="rounded bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground ring-1 ring-black/5">{product.spec_1}</span>
              )}
              {product.spec_2 && (
                <span className="rounded bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground ring-1 ring-black/5">{product.spec_2}</span>
              )}
            </div>
            <p className="mt-6 text-sm text-muted-foreground leading-relaxed">{product.description}</p>
            <p className="mt-6 font-mono text-xs text-muted-foreground">
              Stock: {product.stock} units available
            </p>

            <div className="mt-8 flex items-center gap-4">
              <div className="flex items-center rounded-md border border-border">
                <button className="px-3 py-2 text-sm" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span className="w-10 text-center font-mono text-sm">{qty}</span>
                <button className="px-3 py-2 text-sm" onClick={() => setQty((q) => Math.min(product.stock, q + 1))}>+</button>
              </div>
              <button
                onClick={() => toggleWishlist({
                  id: product.id, slug: product.slug, name: product.name,
                  price_rwf: Number(product.price_rwf), image_url: product.image_url,
                })}
                aria-label="Toggle wishlist"
                className="grid size-11 place-items-center rounded-md ring-1 ring-border hover:bg-secondary"
              >
                <Heart className={"size-5 " + (wished ? "fill-accent stroke-accent" : "stroke-foreground")} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                disabled={product.stock === 0}
                onClick={handleAddToCart}
                className="rounded-md ring-1 ring-border py-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                {product.stock === 0 ? "Out of stock" : ctaLabel}
              </button>
              <button
                disabled={product.stock === 0}
                onClick={handleBuyNow}
                className="rounded-md bg-accent py-3 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-24">
            <h2 className="mb-6 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">
              You may also like
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
              {similar.map((p) => (<ProductCard key={p.id} product={p} />))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
