import { Drawer } from "vaul";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";

/**
 * One sheet for the whole shop: a swipe-down bottom sheet on phones and tablets,
 * a side drawer from the right on desktop (side="auto"), or always a bottom sheet (side="bottom").
 */
export function Sheet(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: "auto" | "bottom";
  tall?: boolean;
}) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const right = desktop && (props.side ?? "auto") === "auto";

  return (
    <Drawer.Root open={props.open} onOpenChange={props.onOpenChange} direction={right ? "right" : "bottom"}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className={
            "fixed z-[61] flex flex-col bg-background outline-none " +
            (right
              ? "inset-y-0 right-0 w-full max-w-md border-l border-border"
              : `inset-x-0 bottom-0 rounded-t-2xl border-t border-border ${props.tall ? "h-[92dvh]" : "max-h-[88dvh]"}`)
          }
        >
          {!right && <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />}
          <div className="flex items-center justify-between px-5 pb-3 pt-3">
            <Drawer.Title className="text-base font-medium">{props.title}</Drawer.Title>
            <button onClick={() => props.onOpenChange(false)} aria-label="Close"
              className="grid size-9 place-items-center rounded-full hover:bg-secondary">
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
            {props.children}
          </div>
          {props.footer && (
            <div className="border-t border-border px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{props.footer}</div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
