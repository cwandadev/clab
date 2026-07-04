import { useEffect, useState } from "react";

const LANGS = [
  { code: "en", label: "English" },
  { code: "rw", label: "Kinyarwanda" },
  { code: "fr", label: "Français" },
  { code: "ru", label: "Русский" },
  { code: "sw", label: "Kiswahili" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
];

const STORAGE_KEY = "clab.lang";
const CACHE_KEY = "clab.lang.cache.v1";

type Cache = Record<string, Record<string, string>>; // lang -> (src -> translated)

function loadCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveCache(c: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {}
}

async function translateOne(text: string, target: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    text
  )}&langpair=en|${target}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("translate failed");
  const data = await res.json();
  return data?.responseData?.translatedText || text;
}

function collectTextNodes(root: HTMLElement): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const t = node.nodeValue?.trim();
      if (!t || t.length < 2) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.tagName;
      if (
        ["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "INPUT"].includes(
          tag
        )
      )
        return NodeFilter.FILTER_REJECT;
      if (p.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) out.push(n as Text);
  return out;
}

async function translatePage(target: string, setProgress: (p: number) => void) {
  if (target === "en") {
    // Restore originals
    document.querySelectorAll<HTMLElement>("[data-orig-text]").forEach((el) => {
      const orig = el.getAttribute("data-orig-text");
      if (orig != null) {
        // text node trick: we stored on parent element when translating
      }
    });
    // Simpler: reload
    location.reload();
    return;
  }
  const nodes = collectTextNodes(document.body);
  const cache = loadCache();
  cache[target] = cache[target] || {};
  const unique = Array.from(new Set(nodes.map((n) => n.nodeValue!.trim())));
  let done = 0;
  for (const text of unique) {
    if (!cache[target][text]) {
      try {
        cache[target][text] = await translateOne(text, target);
      } catch {
        cache[target][text] = text;
      }
    }
    done++;
    if (done % 5 === 0) setProgress(Math.round((done / unique.length) * 100));
  }
  saveCache(cache);
  nodes.forEach((node) => {
    const key = node.nodeValue!.trim();
    const translated = cache[target][key];
    if (translated) node.nodeValue = node.nodeValue!.replace(key, translated);
  });
  document.documentElement.setAttribute("lang", target);
  setProgress(100);
}

export function LanguageSelector() {
  const [lang, setLang] = useState("en");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== "en") {
      setLang(saved);
      setBusy(true);
      translatePage(saved, setProgress).finally(() => setBusy(false));
    }
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && e.newValue !== lang) {
        setLang(e.newValue);
        setBusy(true);
        setProgress(0);
        translatePage(e.newValue, setProgress).finally(() => setBusy(false));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [lang]);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const target = e.target.value;
    setLang(target);
    localStorage.setItem(STORAGE_KEY, target);
    setBusy(true);
    setProgress(0);
    await translatePage(target, setProgress);
    setBusy(false);
  };

  return (
    <div data-no-translate>
      <select
        value={lang}
        onChange={onChange}
        disabled={busy}
        className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {busy ? `Translating… ${progress}%` : "Powered by MyMemory · cached locally"}
      </p>
    </div>
  );
}
