import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Share, Plus } from "lucide-react";
import { Sheet } from "./Sheet";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();

/** Registers the service worker (production builds only), offers updates, and reports offline/online. */
export function PwaManager() {
  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach((l) => l()); };
    const onInstalled = () => { deferred = null; listeners.forEach((l) => l()); toast.success("Clab is installed on this device"); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    let offlineToast: string | number | undefined;
    const offline = () => { offlineToast = toast.message("You're offline", { description: "Pages you open now may not load until you reconnect.", duration: Infinity }); };
    const online = () => { if (offlineToast !== undefined) toast.dismiss(offlineToast); toast.success("Back online"); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);

    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloading) { reloading = true; location.reload(); } });
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        const offer = (w: ServiceWorker) => toast.message("A new version of the shop is ready", {
          duration: Infinity, action: { label: "Reload", onClick: () => w.postMessage("SKIP_WAITING") },
        });
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(w); });
        });
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      }).catch((e) => console.warn("[sw] register failed", e));
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);
  return null;
}

/** "Install app": the browser's own prompt on Android/Chrome/Edge, step-by-step help on iPhone. Hidden once installed. */
export function InstallAppButton({ className = "" }: { className?: string }) {
  const [, rerender] = useState(0);
  const [installed, setInstalled] = useState(true);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent));
    return () => { listeners.delete(l); };
  }, []);

  if (installed || (!deferred && !ios)) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") deferred = null;
      rerender((n) => n + 1);
    } else setHelp(true);
  }

  return (
    <>
      <button onClick={install} className={`inline-flex h-10 items-center gap-2 rounded-md border border-input px-4 text-sm hover:bg-secondary ${className}`}>
        <Download className="size-4" /> Install the app
      </button>
      <Sheet open={help} onOpenChange={setHelp} title="Add Clab to your Home Screen" side="bottom">
        <ol className="space-y-4 pb-6 text-sm">
          <li className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-secondary font-mono">1</span>Tap <Share className="mx-1 inline size-4" aria-label="Share" /> at the bottom of Safari.</li>
          <li className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-secondary font-mono">2</span>Choose <b className="inline-flex items-center gap-1">Add to Home Screen <Plus className="size-4" /></b></li>
          <li className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-secondary font-mono">3</span>Tap <b>Add</b>. Clab opens full screen like an app.</li>
        </ol>
      </Sheet>
    </>
  );
}
