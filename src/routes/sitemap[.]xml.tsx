import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? "http://localhost:3000";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/auth", changefreq: "monthly", priority: "0.3" },
          { path: "/cart", changefreq: "monthly", priority: "0.5" },
          { path: "/checkout", changefreq: "monthly", priority: "0.5" },
          { path: "/wishlist", changefreq: "monthly", priority: "0.5" },
        ];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: products, error } = await supabaseAdmin
          .from("products")
          .select("slug, created_at")
          .eq("active", true)
          .order("created_at", { ascending: false });

        if (error) throw new Error(error.message);

        for (const product of products ?? []) {
          if (product.slug) {
            entries.push({
              path: `/products/${product.slug}`,
              changefreq: "weekly",
              priority: "0.8",
              lastmod: product.created_at ? new Date(product.created_at).toISOString().split("T")[0] : undefined,
            });
          }
        }


        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
