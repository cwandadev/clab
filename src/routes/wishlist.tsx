import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Clab" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist } = useStore();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-medium tracking-tight">Your Wishlist</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {wishlist.length} {wishlist.length === 1 ? "item" : "items"} saved.
        </p>

        {wishlist.length === 0 ? (
          <div className="mt-12 rounded-lg border border-border p-12 text-center text-sm text-muted-foreground">
            No favorites yet.{" "}
            <Link to="/" className="underline">Browse products</Link>.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-border ring-1 ring-border rounded-lg overflow-hidden">
            {wishlist.map((w) => (
              <ProductCard
                key={w.id}
                product={{
                  id: w.id, slug: w.slug, name: w.name,
                  description: null, price_rwf: w.price_rwf,
                  image_url: w.image_url, spec_1: null, spec_2: null, stock: 99,
                }}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
