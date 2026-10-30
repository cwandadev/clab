import { Link } from "@tanstack/react-router";
import { ShoppingCart, User, Heart, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { CURRENCIES } from "@/lib/currency";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { FREE_SHIPPING_KIGALI_RWF } from "@/lib/store";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { UserAvatar } from "./UserAvatar";
import { SearchSheet } from "./SearchSheet";

const BANNER_KEY = "clab.banner.kigali.dismissed";

export function Header() {
  const { cartCount, wishlistCount, currency, setCurrency } = useStore();
  const { user } = useCurrentUser();
  const { setCartOpen } = useStore();
  const [bannerVisible, setBannerVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_KEY);
    setBannerVisible(!dismissed);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          <Link to="/" className="flex items-center gap-2 shrink-0" data-no-translate>
            <Logo className="size-8" />
            <div className="flex flex-col leading-none">
              <span className="font-mono text-sm font-bold tracking-tight">Clab</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                from tieflab · hardware
              </span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-sm font-medium text-foreground" }}
              activeOptions={{ exact: true }}
            >
              Shop
            </Link>
            <Link
              to="/wishlist"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:hidden lg:inline"
            >
              Wishlist
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-1 rounded-md bg-secondary p-0.5 ring-1 ring-black/5" data-no-translate>
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={
                  "rounded px-2 py-1 font-mono text-[10px] transition-colors " +
                  (currency === c
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {c === "RWF" ? "FRW" : c}
              </button>
            ))}
          </div>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as never)}
            className="sm:hidden rounded-md bg-secondary px-2 py-1 font-mono text-[10px] ring-1 ring-black/5"
            data-no-translate
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c === "RWF" ? "FRW" : c}
              </option>
            ))}
          </select>
          <Link
            to="/wishlist"
            className="relative hidden sm:inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
            aria-label="Wishlist"
          >
            <Heart className="size-4" />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[9px] text-accent-foreground">
                {wishlistCount}
              </span>
            )}
          </Link>
          <button onClick={() => setSearchOpen(true)} aria-label="Search"
            className="hidden md:inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
            <Search className="size-4" />
          </button>
          {user && <NotificationBell userId={user.id} />}
          {user ? (
            <Link to="/account" aria-label="Account" title={user.name}
              className="hidden sm:inline-flex size-9 items-center justify-center rounded-full hover:ring-2 hover:ring-border">
              <UserAvatar name={user.name} url={user.avatarUrl} size={30} />
            </Link>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: "/", code: undefined, error: undefined, error_description: undefined as any }}
              className="hidden sm:inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
              aria-label="Sign in"
            >
              <User className="size-4" />
            </Link>
          )}
          <button
            onClick={() => setCartOpen(true)}
            aria-label={`Cart, ${cartCount} items`}
            className="hidden md:flex items-center gap-2 rounded-md bg-foreground py-2 pl-2 pr-3 text-sm font-medium text-background ring-1 ring-foreground"
            data-no-translate
          >
            <ShoppingCart className="size-4 shrink-0" />
            <span className="font-mono text-xs" data-no-translate>
              [{String(cartCount).padStart(2, "0")}]
            </span>
          </button>
        </div>
      </nav>
      {bannerVisible && (
        <div className="bg-foreground py-1.5 text-background relative group">
          <p className="text-center font-mono text-[10px] uppercase tracking-widest">
            Kigali delivery: free from RWF {FREE_SHIPPING_KIGALI_RWF.toLocaleString("en-US")} · Pay with MTN MoMo or Airtel Money
          </p>
          <button
            onClick={() => { localStorage.setItem(BANNER_KEY, "1"); setBannerVisible(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-background/70 hover:text-background"
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        </div>
      )}
      <SearchSheet open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
