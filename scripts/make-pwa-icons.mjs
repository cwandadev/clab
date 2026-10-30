// Builds the install icon for Android ("maskable": the logo sits inside a safe circle) from the
// existing favicon-512x512.png, then writes the web app manifest. Uses sharp, already a dependency.
// Run: node scripts/make-pwa-icons.mjs
import { existsSync, writeFileSync } from "node:fs";

const icons = [
  { src: "/favicon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/favicon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
];

try {
  const sharp = (await import("sharp")).default;
  if (!existsSync("public/favicon-512x512.png")) throw new Error("public/favicon-512x512.png not found");
  const logo = await sharp("public/favicon-512x512.png").resize(340, 340, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: "#fafafa" } })
    .composite([{ input: logo, gravity: "center" }]).png().toFile("public/icon-maskable-512.png");
  icons.push({ src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" });
  console.log("✔ public/icon-maskable-512.png");
} catch (e) {
  console.log("! maskable icon skipped:", e.message, "(the app still installs with the normal icons)");
}

const manifest = {
  name: "tieflab — Clab electronics",
  short_name: "Clab",
  description: "Electronic components, lab tools and creative hardware, delivered in Kigali.",
  id: "/",
  start_url: "/?source=app",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#fafafa",
  theme_color: "#fafafa",
  lang: "en",
  categories: ["shopping"],
  icons,
  shortcuts: [
    { name: "My orders", short_name: "Orders", url: "/account?source=app", icons: [{ src: "/favicon-192x192.png", sizes: "192x192" }] },
    { name: "Saved items", short_name: "Saved", url: "/wishlist?source=app", icons: [{ src: "/favicon-192x192.png", sizes: "192x192" }] },
  ],
};
writeFileSync("public/manifest.webmanifest", JSON.stringify(manifest, null, 2) + "\n");
console.log("✔ public/manifest.webmanifest");
