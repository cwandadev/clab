import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Sheet } from "./Sheet";
import { ProductImage } from "./ProductImage";
import { productsQO } from "@/lib/catalog";
import { formatPrice } from "@/lib/currency";
import { useStore } from "@/lib/store";

export function SearchSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { currency } = useStore();
  const { data: products = [] } = useQuery({ ...productsQO, enabled: open });
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 250); }, [open]);

  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return products.filter((p) => {
      const hay = [p.name, p.category, p.spec_1, p.spec_2, p.description].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, 30);
  }, [q, products]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Search" side="bottom" tall>
      <div className="sticky top-0 z-10 -mx-5 bg-background px-5 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search"
            placeholder="Arduino, LED, 5V, soldering…" aria-label="Search products"
            className="w-full rounded-lg border border-input bg-background py-3 pl-9 pr-3 text-base" />
        </div>
      </div>
      {q.trim() && results.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing matches “{q}”. Try fewer words.</p>
      )}
      <ul className="divide-y divide-border pb-6">
        {results.map((p) => (
          <li key={p.id}>
            <Link to="/products/$slug" params={{ slug: p.slug }} onClick={() => onOpenChange(false)} className="flex items-center gap-3 py-2.5">
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
