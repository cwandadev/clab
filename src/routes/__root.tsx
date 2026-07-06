import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { StoreProvider } from "../lib/store";
import { supabase } from "@/integrations/supabase/client";

function ThemeInitializer() {
  useEffect(() => {
    const saved = localStorage.getItem("clab.theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);
  return null;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-mono text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Component not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page does not exist in our archive.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Back to inventory
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Clab — DIY Electronics, Components & Creative Hardware" },
      {
        name: "description",
        content:
          "Clab from tieflab — Hardware Innovation. LEDs, Arduino, Raspberry Pi, soldering tools, futuristic bulbs and creative DIY electronics. Free Kigali shipping over $10.",
      },
      { property: "og:title", content: "Clab — DIY Electronics, Components & Creative Hardware" },
      {
        property: "og:description",
        content: "High-tolerance components, microcontrollers and creative lighting from Clab.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Clab — DIY Electronics, Components & Creative Hardware" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..600;1,400..600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      // Primary favicon (SVG for modern browsers)
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/clab.svg",
      },
      // PNG fallbacks for different sizes
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: "/favicon-192x192.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "512x512",
        href: "/favicon-512x512.png",
      },
      // Apple touch icon
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      // WebP for modern browsers
      {
        rel: "icon",
        type: "image/webp",
        href: "/favicon.webp",
      },
      // ICO for legacy browsers
      {
        rel: "shortcut icon",
        href: "/favicon.ico",
      },
    ],
    scripts: [],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthSubscriber() {
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <AuthSubscriber />
        <ThemeInitializer />
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
          <Outlet />
        </Suspense>
        <Toaster position="bottom-right" richColors />
      </StoreProvider>
    </QueryClientProvider>
  );
}