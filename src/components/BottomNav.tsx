import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, Search, ShoppingCart, Heart } from "lucide-react";
import { useStore } from "@/lib/store";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { UserAvatar } from "./UserAvatar";
import { SearchSheet } from "./SearchSheet";

const HIDE_ON = [/^\/admin/, /^\/checkout/, /^\/auth/];

/** Phone and small-tablet tab bar. Hides while scrolling down, returns when scrolling up. */
export function BottomNav() {
  const { pathname } = useLocation();
  const { cartCount, wishlistCount, setCartOpen, cartOpen } = useStore();
  const { user } = useCurrentUser();
  const [hidden, setHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      if (y < 120) { setHidden(false); last = y; return; }   // always visible near the top
      if (Math.abs(y - last) < 8) return;
      setHidden(y > last && y > 120);
      last = y;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // show again after navigating or when a sheet opens/closes (scroll locks can skip scroll events)
  useEffect(() => { setHidden(false); }, [pathname, cartOpen, searchOpen]);

  if (HIDE_ON.some((re) => re.test(pathname))) return null;

  const item = "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium";
  const tone = (on: boolean) => (on ? "text-foreground" : "text-muted-foreground");
  const badge = (n: number) => n > 0 && (
    <span className="absolute left-1/2 top-1 ml-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[9px] text-accent-foreground">
      {n > 99 ? "99+" : n}
    </span>
  );

  return (
    <>
      <div className="h-[calc(3.75rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
      <nav aria-label="Main"
        className={`fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-transform duration-200 md:hidden ${hidden ? "translate-y-full" : ""}`}>
        <div className="flex h-15 items-stretch">
          <Link to="/" className={`${item} ${tone(pathname === "/")}`}><Store className="size-5" />Shop</Link>
          <button onClick={() => setSearchOpen(true)} className={`${item} ${tone(false)}`}><Search className="size-5" />Search</button>
          <button onClick={() => setCartOpen(true)} className={`${item} ${tone(false)}`} aria-label={`Cart, ${cartCount} items`}>
            <ShoppingCart className="size-5" />Cart{badge(cartCount)}
          </button>
          <Link to="/wishlist" className={`${item} ${tone(pathname === "/wishlist")}`}><Heart className="size-5" />Saved{badge(wishlistCount)}</Link>
          {user ? (
            <Link to="/account" className={`${item} ${tone(pathname.startsWith("/account"))}`}>
              <UserAvatar name={user.name} url={user.avatarUrl} size={22} className={pathname.startsWith("/account") ? "ring-2 ring-foreground" : ""} />
              Account
            </Link>
          ) : (
            <Link to="/auth" search={{ redirect: pathname } as never} className={`${item} ${tone(false)}`}>
              <UserAvatar name="?" url={null} size={22} className="bg-muted-foreground/30 text-foreground" />Sign in
            </Link>
          )}
        </div>
      </nav>
      <SearchSheet open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
