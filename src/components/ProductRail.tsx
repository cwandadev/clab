import { ProductCard, type ProductCardData } from "./ProductCard";

/** A horizontal row of cards: swipe on phones, a grid on wide screens. */
export function ProductRail({ title, products }: { title: string; products: ProductCardData[] }) {
  if (products.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 xl:mx-0 xl:grid xl:grid-cols-4 xl:gap-4 xl:overflow-visible xl:px-0">
        {products.map((p) => (
          <div key={p.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] xl:w-auto"><ProductCard product={p} /></div>
        ))}
      </div>
    </section>
  );
}
