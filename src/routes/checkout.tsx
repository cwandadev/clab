import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Smartphone, Banknote, Truck, Store, Loader2, ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { useStore, shippingFeeRwf, FREE_SHIPPING_KIGALI_RWF } from "@/lib/store";
import { formatPrice, formatRwf } from "@/lib/currency";
import { placeOrder, predictPayerPhone, startMomoPayment } from "@/lib/checkout.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Clab" }] }),
  component: CheckoutPage,
});

type Provider = "MTN_MOMO_RWA" | "AIRTEL_RWA";
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "MTN_MOMO_RWA", label: "MTN MoMo" },
  { id: "AIRTEL_RWA", label: "Airtel Money" },
];

function CheckoutPage() {
  const { cart, currency, subtotalRwf, clearCart } = useStore();
  const navigate = useNavigate();
  const place = useServerFn(placeOrder);
  const predict = useServerFn(predictPayerPhone);
  const startPay = useServerFn(startMomoPayment);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "Kigali", address: "", notes: "" });
  const [pickup, setPickup] = useState(false);
  const [method, setMethod] = useState<"momo" | "cash">("momo");
  const [payPhone, setPayPhone] = useState("");
  const [provider, setProvider] = useState<Provider | null>(null);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "order" | "pay">(null);

  const shipping = shippingFeeRwf(form.city, subtotalRwf, pickup);
  const total = subtotalRwf + shipping;
  const toFree = FREE_SHIPPING_KIGALI_RWF - subtotalRwf;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setAuthed(!!data.user);
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles")
        .select("display_name, first_name, last_name, phone, location_city, location_address")
        .eq("id", data.user.id).maybeSingle();
      const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.display_name || "";
      setForm((f) => ({
        ...f,
        email: data.user!.email ?? f.email,
        name: f.name || name,
        phone: f.phone || p?.phone || "",
        city: p?.location_city?.toLowerCase().includes("kigali") || !p?.location_city ? "Kigali" : "Other (Rwanda)",
        address: f.address || p?.location_address || "",
      }));
      if (p?.phone) setPayPhone((v) => v || p.phone!);
    })();
  }, []);

  // Pre-select the network for the number, but let the customer override it (pawaPay advice).
  async function checkPayPhone(value = payPhone) {
    if (value.replace(/\D/g, "").length < 9) return;
    const r = await predict({ data: { phone: value } });
    if (r.ok) { setProvider(r.provider); setPhoneHint(null); }
    else { setProvider(null); setPhoneHint(r.message); }
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-24 text-center">
          <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          <Link to="/" className="mt-4 inline-block underline">Continue shopping</Link>
        </main>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authed) {
      navigate({ to: "/auth", search: { redirect: "/checkout" } as never });
      return;
    }
    if (method === "momo" && !provider) {
      toast.error("Choose your mobile money network.");
      return;
    }
    setBusy("order");
    try {
      const order = await place({
        data: {
          items: cart.map((i) => ({ product_id: i.id, quantity: i.quantity })),
          customer: {
            ...form,
            city: pickup ? "Kigali" : form.city,
            address: pickup ? "Pickup at the tieflab shop" : form.address,
          },
          payment_method: method,
          pickup,
          anonymous: false,
          display_currency: currency,
        },
      });
      clearCart(); // the order now holds the items and their stock

      if (method === "momo") {
        setBusy("pay");
        const pay = await startPay({ data: { order_id: order.order_id, phone: payPhone, provider: provider! } });
        if (!pay.ok) toast.error(pay.message);
      } else {
        toast.success(`Order ${order.order_code} placed. Pay ${pickup ? "at pickup" : "on delivery"}.`);
      }
      navigate({ to: "/orders/$id", params: { id: order.order_id } });
    } catch (err) {
      toast.error((err as Error).message || "Checkout failed");
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-medium tracking-tight">Checkout</h1>

        {authed === false && (
          <div className="mt-6 rounded-md border border-accent/30 bg-accent/5 p-4 text-sm">
            Please{" "}
            <Link to="/auth" search={{ redirect: "/checkout" } as never} className="font-medium underline">sign in</Link>{" "}
            to place your order. Your cart is kept.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <fieldset className="space-y-4">
              <Legend>Contact</Legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Full name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <Input label="Phone (we call this number)" required type="tel" value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })} placeholder="078…" />
              </div>
              <Input label="Email" type="email" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            </fieldset>

            <fieldset className="space-y-4">
              <Legend>Delivery</Legend>
              <div className="grid grid-cols-2 gap-3">
                <Choice active={!pickup} onClick={() => setPickup(false)} icon={<Truck className="size-4" />}
                  title="Deliver to me" sub={form.city === "Kigali" ? (subtotalRwf >= FREE_SHIPPING_KIGALI_RWF ? "Free in Kigali" : "RWF 2,000 in Kigali") : "RWF 8,000 outside Kigali"} />
                <Choice active={pickup} onClick={() => setPickup(true)} icon={<Store className="size-4" />}
                  title="Pick up" sub="Free · Kigali shop" />
              </div>
              {!pickup && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium">City</label>
                    <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option>Kigali</option>
                      <option>Other (Rwanda)</option>
                    </select>
                  </div>
                  <Input label="Address, street or landmark" required value={form.address}
                    onChange={(v) => setForm({ ...form, address: v })} placeholder="e.g. KG 7 Ave, near …" />
                </>
              )}
              <Input label="Notes for us (optional)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })}
                placeholder="Preferred time, gate code…" />
            </fieldset>

            <fieldset className="space-y-4">
              <Legend>Payment</Legend>
              <div className="grid grid-cols-2 gap-3">
                <Choice active={method === "momo"} onClick={() => setMethod("momo")} icon={<Smartphone className="size-4" />}
                  title="Mobile money" sub="MTN MoMo · Airtel Money" />
                <Choice active={method === "cash"} onClick={() => setMethod("cash")} icon={<Banknote className="size-4" />}
                  title="Cash" sub={pickup ? "Pay at pickup" : "Pay on delivery"} />
              </div>

              {method === "momo" && (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <label className="block text-xs font-medium">Mobile money number</label>
                  <div className="flex">
                    <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-secondary px-3 font-mono text-sm">+250</span>
                    <input type="tel" required inputMode="numeric" value={payPhone} placeholder="78 123 4567"
                      onChange={(e) => { setPayPhone(e.target.value); setPhoneHint(null); }}
                      onBlur={() => checkPayPhone()}
                      className="w-full rounded-r-md border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  {phoneHint && <p className="text-xs text-destructive">{phoneHint}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    {PROVIDERS.map((p) => (
                      <button type="button" key={p.id} onClick={() => setProvider(p.id)}
                        className={`rounded-md border px-3 py-2 text-sm transition-colors ${provider === p.id ? "border-accent bg-accent/10 font-medium" : "border-input hover:bg-secondary"}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You'll get a prompt on this phone for exactly {formatRwf(total)}. Approve it with your PIN within 15 minutes.
                  </p>
                </div>
              )}
            </fieldset>
          </div>

          <aside className="h-fit rounded-lg border border-border bg-background p-6 lg:sticky lg:top-20">
            <Legend>Order summary</Legend>
            <ul className="mt-4 space-y-2 text-sm">
              {cart.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span className="truncate">{i.name} <span className="text-muted-foreground">×{i.quantity}</span></span>
                  <span className="font-mono">{formatRwf(i.price_rwf * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
              <Row label="Subtotal" value={formatRwf(subtotalRwf)} />
              <Row label={pickup ? "Pickup" : "Delivery"} value={shipping === 0 ? "FREE" : formatRwf(shipping)} />
              {!pickup && form.city === "Kigali" && toFree > 0 && (
                <p className="text-xs text-muted-foreground">Add {formatRwf(toFree)} more for free Kigali delivery.</p>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-medium">
                <span>Total</span><span className="font-mono">{formatRwf(total)}</span>
              </div>
              {currency !== "RWF" && (
                <p className="text-right text-xs text-muted-foreground">{formatPrice(total, currency)} · charged in RWF</p>
              )}
            </div>
            <button type="submit" disabled={!!busy}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-60">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy === "order" ? "Placing order…" : busy === "pay" ? "Sending payment prompt…" :
                method === "momo" ? `Pay ${formatRwf(total)}` : "Place order"}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Prices are checked on our server. Stock is held for you while you pay.
            </p>
          </aside>
        </form>
      </main>
    </div>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return <legend className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{children}</legend>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-mono">{value}</span></div>;
}

function Choice(props: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button type="button" onClick={props.onClick} aria-pressed={props.active}
      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${props.active ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-input hover:bg-secondary"}`}>
      <span className="mt-0.5">{props.icon}</span>
      <span><span className="block text-sm font-medium">{props.title}</span><span className="block text-xs text-muted-foreground">{props.sub}</span></span>
    </button>
  );
}

function Input(props: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{props.label}</label>
      <input type={props.type || "text"} required={props.required} value={props.value} placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
