import { useState } from "react";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Photo if it loads, otherwise initials. Never a broken image. */
export function UserAvatar({ name, url, size = 28, className = "" }: { name: string; url: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (url && !broken) {
    return <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} style={style}
      className={`shrink-0 rounded-full object-cover ring-1 ring-black/10 ${className}`} />;
  }
  return (
    <span style={style} aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-foreground font-medium text-background ${className}`}>
      {initials(name)}
    </span>
  );
}
