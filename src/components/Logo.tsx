import { useState, useEffect } from "react";

export function Logo({ className = "size-7" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <img
      src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
      alt="Clab from tieflab"
      className={`${className} rounded object-contain`}
    />
  );
}
