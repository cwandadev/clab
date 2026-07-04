import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { listProducts } from "@/lib/products.functions";

const productsQO = queryOptions({
  queryKey: ["products"],
  queryFn: () => listProducts(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "tieflab, CLab — BUY Electronics, Arduino, LEDs & Creative Hardware" },
      {
        name: "description",
        content:
          "Shop Arduino, Raspberry Pi, LEDs, resistors, soldering tools, futuristic bulbs and creative DIY electronics from tieflab. Free Kigali shipping over $10.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQO),
  component: Index,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Could not load products: {error.message}
    </div>
  ),
});

function Index() {
  const { data: products } = useSuspenseQuery(productsQO);
  const [category, setCategory] = useState<string | null>(null);
  const [voltage, setVoltage] = useState<Set<string>>(new Set());

  const categories = Array.from(new Set(products.map((p) => p.category)));
  const counts = categories.reduce<Record<string, number>>((acc, c) => {
    acc[c] = products.filter((p) => p.category === c).length;
    return acc;
  }, {});

  let filtered = category ? products.filter((p) => p.category === category) : products;
  if (voltage.size > 0) {
    filtered = filtered.filter((p) =>
      Array.from(voltage).some((v) => (p.spec_1 || "").includes(v) || (p.spec_2 || "").includes(v)),
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="w-full lg:w-56 shrink-0 space-y-8 lg:sticky lg:top-4 lg:self-start">
            <section>
              <h3 className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Category_Idx
              </h3>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => setCategory(null)}
                    className={
                      "group flex w-full justify-between text-sm " +
                      (category === null ? "text-accent font-medium" : "")
                    }
                  >
                    <span>All</span>
                    <span className="font-mono text-muted-foreground">{products.length}</span>
                  </button>
                </li>
                {categories.map((c) => (
                  <li key={c}>
                    <button
                      onClick={() => setCategory(c)}
                      className={
                        "group flex w-full justify-between text-sm " +
                        (category === c ? "text-accent font-medium" : "")
                      }
                    >
                      <span>{c}</span>
                      <span className="font-mono text-muted-foreground group-hover:text-foreground">
                        {counts[c]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Voltage_Range
              </h3>
              <div className="space-y-2">
                {["3.3V", "5.0V", "12.0V"].map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voltage.has(v)}
                      onChange={(e) => {
                        const next = new Set(voltage);
                        if (e.target.checked) next.add(v);
                        else next.delete(v);
                        setVoltage(next);
                      }}
                      className="size-4 rounded border-border"
                    />
                    {v}
                  </label>
                ))}
              </div>
            </section>
          </aside>

          <div className="flex-1">
            <header className="mb-8">
              <h1 className="text-2xl font-medium tracking-tight text-balance leading-none">
                Electronic Components & Creative DIY Hardware
              </h1>
              <p className="mt-2 max-w-[56ch] text-sm text-muted-foreground text-pretty">
                tieflab from Clab — source LEDs, microcontrollers, lab tools, futuristic lighting,
                and acrylic creations for makers and engineers.
              </p>
            </header>

            {filtered.length === 0 ? (
              <p className="rounded-lg border border-border p-12 text-center text-sm text-muted-foreground">
                No products match these filters.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-border ring-1 ring-border rounded-lg overflow-hidden">
                {filtered.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
