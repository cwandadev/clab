import { InstallAppButton } from "./Pwa";
import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3" data-no-translate>
              <Logo className="size-10" />
              <div className="leading-tight">
                <p className="font-mono text-base font-bold">Clab</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  from tieflab — Hardware Innovation
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground" data-no-translate>
              Clab is the hardware innovation and product-launch branch of tieflab, a hardware and
              software company designing creative DIY electronics for makers and engineers
              worldwide.
            </p>
          </div>

          <div>
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Shop
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/" className="hover:text-accent">All products</Link></li>
              <li><Link to="/wishlist" className="hover:text-accent">Wishlist</Link></li>
              <li><Link to="/cart" className="hover:text-accent">Cart</Link></li>
              <li><Link to="/auth" search={{ redirect: "/", code: undefined, error: undefined, error_description: undefined as any }} className="hover:text-accent">Sign in</Link></li>
            </ul>
          </div>

        </div>

        <div className="mt-10 flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            © {new Date().getFullYear()} Clab · tieflab · Kigali, Rwanda
          </p>
          <InstallAppButton />
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Payments: MTN MoMo · Airtel Money · Cash on delivery
          </p>
        </div>
      </div>
    </footer>
  );
}
