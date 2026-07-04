import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useStore, computeShippingUsd } from "@/lib/store";
import { formatPrice } from "@/lib/currency";
import { createCheckoutSession, confirmOrderPaid } from "@/lib/checkout.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Circuit Archive" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { cart, currency, subtotalUsd, clearCart } = useStore();
  const navigate = useNavigate();
  const createSession = useServerFn(createCheckoutSession);
  const confirmPaid = useServerFn(confirmOrderPaid);

  const [city, setCity] = useState("Kigali");
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    address: "",
  });
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSelfPickup, setIsSelfPickup] = useState(false);

  const shipping = isSelfPickup ? 0 : computeShippingUsd(city, subtotalUsd);
  const total = subtotalUsd + shipping;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
      if (data.user?.email) setForm((f) => ({ ...f, customer_email: data.user!.email! }));
    });
  }, []);

  // Handle Stripe success redirect (?order=...)
  useEffect(() => {
    const url = new URL(window.location.href);
    const orderId = url.searchParams.get("order");
    if (orderId) {
      confirmPaid({ data: { order_id: orderId } })
        .then((r) => {
          if (r.status === "paid") {
            toast.success("Payment confirmed. Order placed!");
            clearCart();
          }
          navigate({ to: "/", replace: true });
        })
        .catch((e) => toast.error(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-24 text-center">
          <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          <Link to="/" className="mt-4 inline-block underline">
            Continue shopping
          </Link>
        </main>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAnonymous && !authed) {
      navigate({ to: "/auth", search: { redirect: "/checkout" } as never });
      return;
    }
    setLoading(true);
    try {
      const origin = window.location.origin;
      const res = await createSession({
        data: {
          ...form,
          customer_phone: form.customer_phone || null,
          city: isSelfPickup ? "Self Pickup" : city,
          address: isSelfPickup ? "Self Pickup" : form.address,
          anonymous: isAnonymous,
          pickup_option: isSelfPickup,
          display_currency: currency,
          items: cart.map((i) => ({ product_id: i.id, quantity: i.quantity })),
          success_url: `${origin}/checkout`,
          cancel_url: `${origin}/cart`,
        },
      });
      window.location.href = res.url;
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-medium tracking-tight">Checkout</h1>

        {authed === false && (
          <div className="mt-6 rounded-md border border-accent/30 bg-accent/5 p-4 text-sm">
            Please{" "}
            <Link to="/auth" search={{ redirect: "/checkout" } as never} className="font-medium underline">
              sign in
            </Link>{" "}
            to complete your order.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-6">
            <fieldset className="space-y-4">
              <legend className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Delivery_Info
              </legend>
              <Input
                label="Full name"
                required
                value={form.customer_name}
                onChange={(v) => setForm({ ...form, customer_name: v })}
              />
              <Input
                label="Email"
                type="email"
                required
                value={form.customer_email}
                onChange={(v) => setForm({ ...form, customer_email: v })}
              />
              <Input
                label="Phone (optional)"
                value={form.customer_phone}
                onChange={(v) => setForm({ ...form, customer_phone: v })}
              />
              <div>
                <label className="block text-xs font-medium mb-1">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option>Kigali</option>
                  <option>Other (Rwanda)</option>
                  <option>International</option>
                </select>
              </div>
              <Input
                label="Address"
                required
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
              />
            </fieldset>
          </div>

          <aside className="h-fit rounded-lg border border-border bg-background p-6">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Order_Summary
            </h2>
            <ul className="space-y-2 text-sm">
              {cart.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {i.name}{" "}
                    <span className="font-mono text-muted-foreground">×{i.quantity}</span>
                  </span>
                  <span className="font-mono">{formatPrice(i.price_usd * i.quantity, currency)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-border pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{formatPrice(subtotalUsd, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-mono">
                  {shipping === 0 ? "FREE" : formatPrice(shipping, currency)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-medium text-base">
                <span>Total</span>
                <span className="font-mono">{formatPrice(total, currency)}</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-md bg-accent py-3 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {loading ? "Redirecting to Stripe…" : "Pay with Card"}
            </button>
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              Secure payment by Stripe. Charged in USD.
            </p>
            <div className="mt-4 border-t border-border pt-4 text-center">
              <a
                href={buildWhatsAppUrl(cart, form, city, subtotalUsd, shipping, total, currency)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[#25D366] hover:underline inline-flex items-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" className="size-3.5 fill-current"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Z"/></svg>
                Order via WhatsApp
              </a>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Chat with us at +250 785 762 690
              </p>
            </div>
          </aside>
        </form>
      </main>
    </div>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{props.label}</label>
      <input
        type={props.type || "text"}
        required={props.required}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function buildWhatsAppUrl(
  cart: { name: string; quantity: number; price_usd: number; image_url: string | null; slug: string }[],
  form: { customer_name: string; customer_email: string; customer_phone: string; address: string },
  city: string,
  subtotalUsd: number,
  shipping: number,
  total: number,
  currency: string,
): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const lines = [
    "🛒 *New Order from Clab*",
    "",
    "*Items:*",
    ...cart.map(
      (i, idx) =>
        `${idx + 1}. ${i.name} ×${i.quantity} — $${(i.price_usd * i.quantity).toFixed(2)}` +
        `\n   Link: ${origin}/products/${i.slug}` +
        (i.image_url ? `\n   Image: ${i.image_url}` : ""),
    ),
    "",
    `*Subtotal:* $${subtotalUsd.toFixed(2)}`,
    `*Shipping:* ${shipping === 0 ? "FREE" : "$" + shipping.toFixed(2)}`,
    `*Total:* $${total.toFixed(2)} USD  (display: ${currency})`,
    "",
    "*Customer:*",
    `Name: ${form.customer_name || "(not provided)"}`,
    `Email: ${form.customer_email || "(not provided)"}`,
    `Phone: ${form.customer_phone || "(not provided)"}`,
    `City: ${city}`,
    `Address: ${form.address || "(not provided)"}`,
  ];
  return `https://wa.me/250785762690?text=${encodeURIComponent(lines.join("\n"))}`;
}
