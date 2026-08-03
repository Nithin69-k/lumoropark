import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { useCurrency } from "@/hooks/useCurrency";

const LABEL: Record<CurrencyCode, string> = { USD: "$ USD", INR: "₹ INR" };

/** Lets a visitor pay and browse in US dollars or Indian rupees. */
export function CurrencySwitcher({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();

  return (
    <div
      className={`inline-flex items-center rounded-full border border-border bg-background p-0.5 ${className ?? ""}`}
      role="group"
      aria-label="Display currency"
    >
      {SUPPORTED_CURRENCIES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setCurrency(code)}
          aria-pressed={currency === code}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            currency === code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {LABEL[code]}
        </button>
      ))}
    </div>
  );
}
