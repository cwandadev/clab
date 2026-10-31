import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import { X, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductImage } from "./ProductImage";

/** Swipeable photos with dots and thumbnails; tap a photo for full screen with zoom. */
export function ProductGallery({ images, alt, category }: { images: string[]; alt: string; category?: string | null }) {
  const [ref, api] = useEmblaCarousel({ loop: false });
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!api) return;
    const on = () => setIndex(api.selectedScrollSnap());
    api.on("select", on); on();
    return () => { api.off("select", on); };
  }, [api]);

  if (images.length === 0) {
    return <div className="overflow-hidden rounded-xl"><ProductImage src={null} alt={alt} category={category} /></div>;
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl" ref={ref}>
        <div className="flex touch-pan-y">
          {images.map((src, i) => (
            <button key={src + i} type="button" onClick={() => setFull(true)} aria-label={`Open photo ${i + 1} full screen`}
              className="relative min-w-0 shrink-0 grow-0 basis-full cursor-zoom-in">
              <ProductImage src={src} alt={i === 0 ? alt : ""} eager={i === 0} sizes="(min-width: 768px) 50vw, 100vw" />
            </button>
          ))}
        </div>
        <span className="pointer-events-none absolute bottom-3 right-3 grid size-8 place-items-center rounded-full bg-background/85 backdrop-blur"><ZoomIn className="size-4" /></span>
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden">
            {images.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-foreground" : "w-1.5 bg-foreground/40"}`} />)}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 hidden gap-2 overflow-x-auto md:flex">
          {images.map((src, i) => (
            <button key={src + i} onClick={() => api?.scrollTo(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index}
              className={`size-16 shrink-0 overflow-hidden rounded-md ring-offset-2 ${i === index ? "ring-2 ring-accent" : "ring-1 ring-black/10"}`}>
              <img src={src} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {full && <Lightbox images={images} start={index} onClose={(i) => { setFull(false); api?.scrollTo(i, true); }} />}
    </div>
  );
}

function Lightbox({ images, start, onClose }: { images: string[]; start: number; onClose: (i: number) => void }) {
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [ref, api] = useEmblaCarousel({ startIndex: start, watchDrag: true });
  const [index, setIndex] = useState(start);

  useEffect(() => {
    if (!api) return;
    const on = () => { setIndex(api.selectedScrollSnap()); setZoom(null); };
    api.on("select", on);
    return () => { api.off("select", on); };
  }, [api]);
  useEffect(() => { api?.reInit({ watchDrag: !zoom }); }, [api, zoom]);   // no swiping while zoomed in

  const close = useCallback(() => onClose(index), [onClose, index]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") api?.scrollNext();
      if (e.key === "ArrowLeft") api?.scrollPrev();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [api, close]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white" role="dialog" aria-modal aria-label="Photos">
      <div className="flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="font-mono text-xs">{index + 1} / {images.length}</span>
        <button onClick={close} aria-label="Close" className="grid size-10 place-items-center rounded-full bg-white/10"><X className="size-5" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden" ref={ref}>
        <div className="flex h-full">
          {images.map((src, i) => (
            <div key={src + i} className="relative h-full min-w-0 shrink-0 grow-0 basis-full overflow-hidden"
              onClick={(e) => {
                if (i !== index) return;
                const r = e.currentTarget.getBoundingClientRect();
                setZoom((z) => (z ? null : { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }));
              }}
              onMouseMove={(e) => {
                if (!zoom || i !== index) return;
                const r = e.currentTarget.getBoundingClientRect();
                setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
              }}>
              <img src={src} alt="" draggable={false}
                className={`size-full select-none object-contain transition-transform duration-200 ${i === index && zoom ? "cursor-zoom-out" : "cursor-zoom-in"}`}
                style={i === index && zoom ? { transform: "scale(2.5)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-6 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button onClick={() => api?.scrollPrev()} disabled={index === 0} aria-label="Previous photo" className="grid size-10 place-items-center rounded-full bg-white/10 disabled:opacity-30"><ChevronLeft className="size-5" /></button>
        <span className="text-xs text-white/60">{zoom ? "Tap to zoom out" : "Tap to zoom"}</span>
        <button onClick={() => api?.scrollNext()} disabled={index === images.length - 1} aria-label="Next photo" className="grid size-10 place-items-center rounded-full bg-white/10 disabled:opacity-30"><ChevronRight className="size-5" /></button>
      </div>
    </div>
  );
}
