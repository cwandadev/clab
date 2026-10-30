import { useState } from "react";
import { Cpu, Lightbulb, Wrench, BatteryCharging, CircuitBoard, Magnet, Package } from "lucide-react";

const ICONS: [RegExp, typeof Package][] = [
  [/micro|controller|arduino|pi/i, Cpu],
  [/light|led|bulb/i, Lightbulb],
  [/tool/i, Wrench],
  [/power|battery/i, BatteryCharging],
  [/pcb|board/i, CircuitBoard],
  [/component|magnet/i, Magnet],
];

/** Square product image: fades in when loaded; a clean category placeholder when there is no photo or it fails. */
export function ProductImage({ src, alt, category, sizes, eager = false, className = "" }: {
  src: string | null | undefined; alt: string; category?: string | null; sizes?: string; eager?: boolean; className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const Icon = ICONS.find(([re]) => re.test(category ?? alt))?.[1] ?? Package;

  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-secondary ${className}`}>
      {src && !failed ? (
        <>
          {!loaded && <div className="absolute inset-0 animate-pulse bg-secondary" aria-hidden />}
          <img src={src} alt={alt} sizes={sizes} loading={eager ? "eager" : "lazy"} decoding="async"
            // an image that finished loading before hydration never fires onLoad: check .complete too
            ref={(el) => { if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true); }}
            onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
            className={`size-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`} />
        </>
      ) : (
        <div className="grid size-full place-items-center">
          <Icon className="size-1/4 text-muted-foreground/40" strokeWidth={1.25} aria-hidden />
        </div>
      )}
    </div>
  );
}
