import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { detectCurrency, type Currency } from "./currency";

export type CartItem = {
  id: string;
  slug: string;
  name: string;
  price_rwf: number;
  image_url: string | null;
  quantity: number;
};

export type WishlistItem = {
  id: string;
  slug: string;
  name: string;
  price_rwf: number;
  image_url: string | null;
};

type StoreState = {
  cart: CartItem[];
  currency: Currency;
  wishlist: WishlistItem[];
  recentlyViewed: string[]; // product ids, most recent first
  addToCart: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  setCurrency: (c: Currency) => void;
  toggleWishlist: (item: WishlistItem) => void;
  isWishlisted: (id: string) => boolean;
  trackView: (id: string) => void;
  cartCount: number;
  wishlistCount: number;
  subtotalRwf: number;
  /** cart sheet (bottom sheet on phones, side drawer on desktop) */
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
};

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [currency, setCurrency] = useState<Currency>("RWF");
  const [cartOpen, setCartOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem("tl_cart");
      const w = localStorage.getItem("tl_wishlist");
      const rv = localStorage.getItem("tl_recent");
      const cur = localStorage.getItem("tl_currency");
      if (c) setCart((JSON.parse(c) as CartItem[]).filter((i) => typeof i.price_rwf === "number"));
      if (w) setWishlist((JSON.parse(w) as WishlistItem[]).filter((i) => typeof i.price_rwf === "number"));
      if (rv) setRecentlyViewed(JSON.parse(rv));
      if (cur) setCurrency(cur as Currency);
      else setCurrency(detectCurrency());
    } catch {}
    setLoaded(true);
  }, []);

  // Write only after the saved values were read. Writing the empty start values first could wipe
  // the saved cart if the provider mounts twice during hydration.
  useEffect(() => { if (loaded) localStorage.setItem("tl_cart", JSON.stringify(cart)); }, [cart, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("tl_wishlist", JSON.stringify(wishlist)); }, [wishlist, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("tl_recent", JSON.stringify(recentlyViewed)); }, [recentlyViewed, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("tl_currency", currency); }, [currency, loaded]);

  const addToCart: StoreState["addToCart"] = (item, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) => (p.id === item.id ? { ...p, quantity: p.quantity + qty } : p));
      }
      return [...prev, { ...item, quantity: qty }];
    });
  };

  const removeFromCart = (id: string) => setCart((p) => p.filter((i) => i.id !== id));
  const updateQty = (id: string, qty: number) =>
    setCart((p) => p.map((i) => (i.id === id ? { ...i, quantity: Math.min(99, Math.max(1, qty)) } : i)));
  const clearCart = () => setCart([]);

  const toggleWishlist = (item: WishlistItem) => {
    setWishlist((prev) =>
      prev.find((p) => p.id === item.id) ? prev.filter((p) => p.id !== item.id) : [...prev, item],
    );
  };
  const isWishlisted = (id: string) => wishlist.some((p) => p.id === id);

  // Stable and a no-op when already first: the product page calls this in an effect,
  // and a new function or array on every call made that effect re-render forever.
  const trackView = useCallback((id: string) =>
    setRecentlyViewed((prev) => (prev[0] === id ? prev : [id, ...prev.filter((x) => x !== id)].slice(0, 20))), []);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotalRwf = cart.reduce((s, i) => s + i.price_rwf * i.quantity, 0);

  return (
    <StoreContext.Provider
      value={{
        cart, currency, wishlist, recentlyViewed,
        addToCart, removeFromCart, updateQty, clearCart,
        setCurrency, toggleWishlist, isWishlisted, trackView,
        cartCount, wishlistCount: wishlist.length, subtotalRwf,
        cartOpen, setCartOpen,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/**
 * Shipping preview — mirrors public.shipping_fee_rwf() in the database,
 * which is what the order is actually charged. Keep the two in sync.
 */
export function shippingFeeRwf(city: string, subtotalRwf: number, pickup = false): number {
  if (pickup) return 0;
  if (city.trim().toLowerCase().includes("kigali")) return subtotalRwf >= 15000 ? 0 : 2000;
  return 8000;
}
export const FREE_SHIPPING_KIGALI_RWF = 15000;

/** Categories considered "electronic components" — buttons say "Add to Kit". */
const COMPONENT_KEYWORDS = [
  "component", "led", "diode", "resistor", "capacit", "arduino", "raspberry",
  "microcontroller", "sensor", "module", "wire", "battery", "pcb", "transistor",
  "ic", "circuit", "magnet", "relay",
];

export function isComponentProduct(p: { category?: string | null; product_type?: string | null }): boolean {
  if (p.product_type === "digital_circuit") return true;
  const cat = (p.category || "").toLowerCase();
  return COMPONENT_KEYWORDS.some((k) => cat.includes(k));
}
