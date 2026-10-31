/**
 * Shrink an image in the browser before upload: saves the customer's data and our storage.
 * Returns WebP where the browser can encode it, otherwise JPEG.
 */
export async function resizeImage(
  file: File,
  opts: { max: number; square?: boolean; quality?: number },
): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("This image could not be read. Try a JPEG or PNG."); });
  let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
  if (opts.square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2; sy = (sh - side) / 2; sw = sh = side;  // centre crop
  }
  const scale = Math.min(1, opts.max / Math.max(sw, sh));
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser cannot resize images.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
  bitmap.close();
  const q = opts.quality ?? 0.82;
  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpg = await toBlob("image/jpeg");
  if (!jpg) throw new Error("Could not prepare the image.");
  return { blob: jpg, ext: "jpg" };
}
