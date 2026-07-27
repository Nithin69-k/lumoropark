import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { getBookingCharge, type BookingCharge } from "@/lib/payments";

export function PayBookingButton({ bookingId }: { bookingId: string }) {
  const [charge, setCharge] = useState<BookingCharge | null>(null);
  const { openCheckout, loading } = usePaddleCheckout();

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
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) throw new Error("Please sign in again");

      await openCheckout({
        items: [
          { priceId: "parking_credit", quantity: charge.credits },
          { priceId: "reservation_fee_flat", quantity: 1 },
        ],
        customerEmail: user.email ?? undefined,
        customData: { bookingId, userId: user.id },
        successUrl: `${window.location.origin}/bookings`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open checkout");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium">Payment needed to confirm this reservation</div>
          {charge && (
            <div className="mt-1 text-xs text-muted-foreground">
              Parking ${charge.base_amount.toFixed(2)} + platform fee $
              {charge.platform_fee.toFixed(2)} + $
              {charge.reservation_fee.toFixed(2)} reservation ={" "}
              <span className="font-semibold text-foreground">${charge.total.toFixed(2)}</span>
            </div>
          )}
        </div>
        <Button size="sm" onClick={pay} disabled={loading || !charge}>
          <CreditCard className="mr-1 h-4 w-4" />
          {loading ? "Opening…" : charge ? `Pay $${charge.total.toFixed(2)}` : "Pay"}
        </Button>
      </div>
    </div>
  );
}
