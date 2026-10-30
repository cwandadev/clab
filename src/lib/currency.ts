export type Currency = "RWF" | "USD" | "EUR" | "GBP";

export const CURRENCIES: Currency[] = ["RWF", "USD", "EUR", "GBP"];

/**
 * All prices are stored and charged in whole Rwandan francs (pawaPay charges RWF).
 * Other currencies are DISPLAY ONLY, approximate, and never used for payment.
 * Units of foreign currency per 1 RWF (≈1,476 RWF per USD, early Oct 2026).
 */
export const RATES: Record<Currency, number> = {
  RWF: 1,
  USD: 1 / 1476,
  EUR: 0.92 / 1476,
  GBP: 0.79 / 1476,
};

const SYMBOLS: Record<Currency, string> = {
  RWF: "RWF ",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function convertFromRwf(rwf: number, currency: Currency): number {
  return rwf * RATES[currency];
}

/** Format an RWF amount in the shopper's display currency. Non-RWF values get a "≈". */
export function formatPrice(rwf: number, currency: Currency): string {
  if (currency === "RWF") return `${SYMBOLS.RWF}${Math.round(rwf).toLocaleString("en-US")}`;
  return `≈${SYMBOLS[currency]}${convertFromRwf(rwf, currency).toFixed(2)}`;
}

/** Always RWF — use where the exact charged amount matters (checkout, receipts, admin). */
export function formatRwf(rwf: number | null | undefined): string {
  return `RWF ${Math.round(Number(rwf ?? 0)).toLocaleString("en-US")}`;
}

/** Best-effort currency guess from browser locale. Defaults to RWF. */
export function detectCurrency(): Currency {
  if (typeof navigator === "undefined") return "RWF";
  const lang = (navigator.language || "en-RW").toLowerCase();
  const region = lang.split("-")[1];
  if (!region) return "RWF";
  if (["us", "ec", "sv", "pa"].includes(region)) return "USD";
  if (["gb", "uk"].includes(region)) return "GBP";
  if (["fr", "de", "es", "it", "nl", "be", "at", "pt", "ie", "fi", "gr", "lu"].includes(region)) return "EUR";
  return "RWF";
}
