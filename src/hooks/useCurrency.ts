import { useCallback, useEffect, useState } from "react";

import {
  getCurrency,
  setCurrency as persistCurrency,
  type CurrencyCode,
} from "@/lib/currency";

/** Reads and updates the visitor's display/payment currency. */
export function useCurrency() {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");

  useEffect(() => {
    setCurrencyState(getCurrency());
    const sync = () => setCurrencyState(getCurrency());
    window.addEventListener("lumorox:currency", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lumorox:currency", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const change = useCallback((code: CurrencyCode) => {
    persistCurrency(code);
    setCurrencyState(code);
  }, []);

  return { currency, setCurrency: change };
}
