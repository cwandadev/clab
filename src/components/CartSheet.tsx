import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2, ShoppingBag, Truck } from "lucide-react";
import { Sheet } from "./Sheet";
import { ProductImage } from "./ProductImage";
import { useStore, FREE_SHIPPING_KIGALI_RWF } from "@/lib/store";
import { formatRwf, formatPrice } from "@/lib/currency";

export function CartSheet() {
  const { cart, cartOpen, setCartOpen, updateQty, removeFromCart, subtotalRwf, currency, cartCount } = useStore();
  const navigate = useNavigate();
  useEffect(() => { if (cartOpen) toast.dismiss(); }, [cartOpen]); // a toast must never cover the Checkout button
  const left = Math.max(0, FREE_SHIPPING_KIGALI_RWF - subtotalRwf);
  const pct = Math.min(100, Math.round((subtotalRwf / FREE_SHIPPING_KIGALI_RWF) * 100));

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen} title={`Cart${cartCount ? ` (${cartCount})` : ""}`}
      footer={cart.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-right">
              <span className="font-mono text-lg">{formatRwf(subtotalRwf)}</span>
              {currency !== "RWF" && <span className="block text-xs text-muted-foreground">{formatPrice(subtotalRwf, currency)}</span>}
            </span>
          </div>
          <button onClick={() => { setCartOpen(false); navigate({ to: "/checkout" }); }}
            className="w-full rounded-md bg-foreground py-3 text-sm font-medium text-background">
            Checkout
          </button>
          <p className="text-center text-xs text-muted-foreground">Delivery is calculated at checkout.</p>
        </div>
      )}>
      {cart.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <ShoppingBag className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          <button onClick={() => setCartOpen(false)} className="text-sm underline">Keep shopping</button>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-lg bg-secondary/60 p-3">
            <p className="flex items-center gap-2 text-xs">
              <Truck className="size-3.5" />
              {left > 0 ? <>Add <b className="font-mono">{formatRwf(left)}</b> for free Kigali delivery</> : <b>Free Kigali delivery unlocked</b>}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <ul className="divide-y divide-border pb-4">
            {cart.map((i) => (
              <li key={i.id} className="flex gap-3 py-3">
                <Link to="/products/$slug" params={{ slug: i.slug }} onClick={() => setCartOpen(false)}
                  className="size-16 shrink-0 overflow-hidden rounded-md">
                  <ProductImage src={i.image_url} alt={i.name} sizes="64px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to="/products/$slug" params={{ slug: i.slug }} onClick={() => setCartOpen(false)}
                    className="line-clamp-2 text-sm font-medium">{i.name}</Link>
                  <p className="font-mono text-xs text-muted-foreground">{formatRwf(i.price_rwf)}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center rounded-md border border-input">
                      <button onClick={() => (i.quantity > 1 ? updateQty(i.id, i.quantity - 1) : removeFromCart(i.id))}
                        aria-label="One less" className="grid size-9 place-items-center"><Minus className="size-3.5" /></button>
                      <span className="w-8 text-center font-mono text-sm" aria-live="polite">{i.quantity}</span>
                      <button onClick={() => updateQty(i.id, i.quantity + 1)} disabled={i.quantity >= 99}
                        aria-label="One more" className="grid size-9 place-items-center disabled:opacity-40"><Plus className="size-3.5" /></button>
                    </div>
                    <span className="font-mono text-sm">{formatRwf(i.price_rwf * i.quantity)}</span>
                  </div>
                </div>
                <button onClick={() => removeFromCart(i.id)} aria-label={`Remove ${i.name}`}
                  className="grid size-9 place-items-center self-start text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
