import { useEffect, useState, createContext, useContext, ReactNode } from "react";

type Cache = Record<string, Record<string, string>>; // lang -> (src -> translated)

const STORAGE_KEY = "clab.lang";
const CACHE_KEY = "clab.lang.cache.v1";

// In-memory cache
let memoryCache: Cache = {};
let memoryCacheInitialized = false;

function initMemoryCache() {
  if (memoryCacheInitialized) return;
  try {
    memoryCache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    memoryCache = {};
  }
  memoryCacheInitialized = true;
}

function loadCache(): Cache {
  initMemoryCache();
  return memoryCache;
}

function saveCache(c: Cache) {
  memoryCache = c;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {}
}

// Translation context
interface TranslationContextType {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string) => string;
  ready: boolean;
}

const TranslationContext = createContext<TranslationContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  ready: false,
});

export function useTranslation() {
  return useContext(TranslationContext);
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

// Common UI strings to translate
const UI_STRINGS: Record<string, string> = {
  "Sign in": "Sign in",
  "Create account": "Create account",
  "Email": "Email",
  "Password": "Password",
  "Display name": "Display name",
  "Sign in with Google": "Sign in with Google",
  "Need an account? Create one": "Need an account? Create one",
  "Already have an account? Sign in": "Already have an account? Sign in",
  "Working...": "Working...",
  "Sending...": "Sending...",
  "Verifying...": "Verifying...",
  "Send code": "Send code",
  "Verify & sign in": "Verify & sign in",
  "Use a different number": "Use a different number",
  "Phone (with country code, e.g. +250...)": "Phone (with country code, e.g. +250...)",
  "Code sent to": "Code sent to",
  "Welcome to tieflab. Sign in with Google, email, or phone.": "Welcome to tieflab. Sign in with Google, email, or phone.",
  "Electronic Components & Creative DIY Hardware": "Electronic Components & Creative DIY Hardware",
  "tieflab from Clab - source LEDs, microcontrollers, lab tools, futuristic lighting, and acrylic creations for makers and engineers.": "tieflab from Clab - source LEDs, microcontrollers, lab tools, futuristic lighting, and acrylic creations for makers and engineers.",
  "All": "All",
  "Category_Idx": "Category_Idx",
  "Voltage_Range": "Voltage_Range",
  "No products match these filters.": "No products match these filters.",
  "Admin Console": "Admin Console",
  "Operational // Warehouse Kigali": "Operational // Warehouse Kigali",
  "Products": "Products",
  "Orders": "Orders",
  "Users": "Users",
  "+ New Product": "+ New Product",
  "Checking access...": "Checking access...",
  "Admin access required": "Admin access required",
  "Your account does not have admin permissions. Ask an existing tieflab admin to grant you access.": "Your account does not have admin permissions. Ask an existing tieflab admin to grant you access.",
  "Loading...": "Loading...",
  "Loading users...": "Loading users...",
  "Display Name": "Display Name",
  "Roles": "Roles",
  "Created": "Created",
  "Actions": "Actions",
  "user": "user",
  "Make admin": "Make admin",
  "Remove admin": "Remove admin",
  "Delete": "Delete",
  "Delete user": "Delete user",
  "This cannot be undone.": "This cannot be undone.",
  "Product deleted": "Product deleted",
  "Admin role removed": "Admin role removed",
  "Admin role granted": "Admin role granted",
  "User deleted": "User deleted",
  "Account created!": "Account created!",
  "Signed in": "Signed in",
  "Authentication failed": "Authentication failed",
  "Could not send code. Phone provider may not be configured.": "Could not send code. Phone provider may not be configured.",
  "Invalid code": "Invalid code",
  "Google sign-in failed": "Google sign-in failed",
  "Slug": "Slug",
  "Name": "Name",
  "Category": "Category",
  "Stock": "Stock",
  "Price": "Price",
  "Edit": "Edit",
  "Powered by MyMemory - cached locally": "Powered by MyMemory - cached locally",
  "Translating...": "Translating...",
  "No orders yet.": "No orders yet.",
  "Customer": "Customer",
  "City": "City",
  "Items": "Items",
  "Status": "Status",
  "Order updated": "Order updated",
};

// Pre-defined translations for common strings (fallback if API fails)
const FALLBACK_TRANSLATIONS: Record<string, Record<string, string>> = {
  rw: {
    "Sign in": "Injira",
    "Create account": "Fungura konti",
    "Email": "Imeli",
    "Password": "Ijambo banga",
    "All": "Byose",
  },
  fr: {
    "Sign in": "Se connecter",
    "Create account": "Créer un compte",
    "Email": "E-mail",
    "Password": "Mot de passe",
    "All": "Tous",
  },
};

export async function translateText(text: string, target: string): Promise<string> {
  if (target === "en") return text;
  
  const cache = loadCache();
  cache[target] = cache[target] || {};
  
  // Check cache first
  if (cache[target][text]) {
    return cache[target][text];
  }
  
  // Check fallback translations
  if (FALLBACK_TRANSLATIONS[target]?.[text]) {
    cache[target][text] = FALLBACK_TRANSLATIONS[target][text];
    saveCache(cache);
    return cache[target][text];
  }
  
  // Try API
  try {
    const translated = await translateOne(text, target);
    cache[target][text] = translated;
    saveCache(cache);
    return translated;
  } catch {
    // Return original on error
    return text;
  }
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState("en");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initMemoryCache();
    
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== "en") {
      setLangState(saved);
      loadTranslations(saved);
    } else {
      setReady(true);
    }
  }, []);

  const loadTranslations = async (target: string) => {
    setReady(false);
    const cache = loadCache();
    cache[target] = cache[target] || {};
    
    // Translate all UI strings in parallel
    const promises = Object.entries(UI_STRINGS).map(async ([key, value]) => {
      if (!cache[target][value]) {
        try {
          cache[target][value] = await translateOne(value, target);
        } catch {
          cache[target][value] = FALLBACK_TRANSLATIONS[target]?.[value] || value;
        }
      }
      return [value, cache[target][value]];
    });
    
    const results = await Promise.all(promises);
    const newTranslations = Object.fromEntries(results);
    
    saveCache(cache);
    setTranslations(newTranslations);
    setReady(true);
  };

  const setLang = (target: string) => {
    setLangState(target);
    localStorage.setItem(STORAGE_KEY, target);
    if (target !== "en") {
      loadTranslations(target);
    } else {
      setTranslations({});
      setReady(true);
    }
  };

  const t = (key: string): string => {
    if (lang === "en") return key;
    return translations[key] || FALLBACK_TRANSLATIONS[lang]?.[key] || key;
  };

  return (
    <TranslationContext.Provider value={{ lang, setLang, t, ready }}>
      {children}
    </TranslationContext.Provider>
  );
}