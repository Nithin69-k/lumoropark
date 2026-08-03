import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useCurrency } from "@/hooks/useCurrency";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { formatUsd } from "@/lib/currency";
import { getPaddleEnvironment } from "@/lib/paddle";
import { getBookingCharge, type BookingCharge } from "@/lib/payments";
import { createBookingCharge } from "@/utils/payments.functions";

export function PayBookingButton({ bookingId }: { bookingId: string }) {
  const [charge, setCharge] = useState<BookingCharge | null>(null);
  const { openCheckout, loading } = usePaddleCheckout();
  const { currency } = useCurrency();
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    getBookingCharge(bookingId)
      .then((c) => alive && setCharge(c))
      .catch(() => alive && setCharge(null));
    return () => {
      alive = false;
    };
  }, [bookingId]);

  async function pay() {
    if (!charge) return;
    setStarting(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) throw new Error("Please sign in again");

      const { transactionId } = await createBookingCharge({
        data: { bookingId, currency, environment: getPaddleEnvironment() },
      });

      await openCheckout({
        transactionId,
        customerEmail: user.email ?? undefined,
        successUrl: `${window.location.origin}/bookings`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open checkout");
    } finally {
      setStarting(false);
    }
  }

  const busy = loading || starting;

  return (
    <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium">Payment needed to confirm this reservation</div>
          {charge && (
            <div className="mt-1 text-xs text-muted-foreground">
              Parking {formatUsd(charge.base_amount, currency)} + platform fee{" "}
              {formatUsd(charge.platform_fee, currency)} +{" "}
              {formatUsd(charge.reservation_fee, currency)} reservation ={" "}
              <span className="font-semibold text-foreground">
                {formatUsd(charge.total, currency)}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CurrencySwitcher />
          <Button size="sm" onClick={pay} disabled={busy || !charge}>
            <CreditCard className="mr-1 h-4 w-4" />
            {busy ? "Opening…" : charge ? `Pay ${formatUsd(charge.total, currency)}` : "Pay"}
          </Button>
        </div>
      </div>
    </div>
  );
}
