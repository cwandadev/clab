import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useStore, shippingFeeRwf } from "@/lib/store";
import { formatPrice } from "@/lib/currency";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your Cart — Circuit Archive" }] }),
  component: CartPage,
});

function CartPage() {
  const { cart, removeFromCart, updateQty, subtotalRwf, currency } = useStore();
  const shipping = shippingFeeRwf("Kigali", subtotalRwf); // preview Kigali shipping
  const total = subtotalRwf + shipping;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main" className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-medium tracking-tight">Your Kit</h1>
        {cart.length === 0 ? (
          <div className="mt-12 rounded-lg border border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">Your kit is empty.</p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-sm text-background"
            >
              Browse inventory
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
            <ul className="divide-y divide-border rounded-lg border border-border bg-background">
              {cart.map((item) => (
                <li key={item.id} className="flex gap-4 p-4">
                  <Link
                    to="/products/$slug"
                    params={{ slug: item.slug }}
                    className="size-20 shrink-0 rounded bg-secondary overflow-hidden grid place-items-center"
                  >
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="size-full object-cover" />
                    ) : (
                      <span className="font-mono text-[9px] text-muted-foreground">IMG</span>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      to="/products/$slug"
                      params={{ slug: item.slug }}
                      className="text-sm font-medium truncate block hover:text-accent"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {formatPrice(item.price_rwf, currency)} ea
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center rounded border border-border">
                        <button
                          className="px-2 py-1 text-xs"
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-mono text-xs">{item.quantity}</span>
                        <button
                          className="px-2 py-1 text-xs"
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <p className="font-mono text-sm">
                    {formatPrice(item.price_rwf * item.quantity, currency)}
                  </p>
                </li>
              ))}
            </ul>

            <aside className="rounded-lg border border-border bg-background p-6 h-fit">
              <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
                Order_Summary
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">{formatPrice(subtotalRwf, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping (Kigali est.)</span>
                  <span className="font-mono">
                    {shipping === 0 ? "FREE" : formatPrice(shipping, currency)}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-border text-base font-medium">
                  <span>Total</span>
                  <span className="font-mono">{formatPrice(total, currency)}</span>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">
                Charged in RWF. {currency !== "RWF" ? "Other currencies are approximate." : ""}
              </p>
              <Link
                to="/checkout"
                className="mt-6 block rounded-md bg-accent py-3 text-center text-sm font-medium text-accent-foreground"
              >
                Proceed to Checkout
              </Link>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
