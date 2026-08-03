import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";
import { formatUsdAsInr } from "@/lib/currency";
import { getBookingCharge, type BookingCharge } from "@/lib/payments";
import { createBookingOrder, verifyPayment } from "@/utils/payments.functions";

export function PayBookingButton({ bookingId }: { bookingId: string }) {
  const [charge, setCharge] = useState<BookingCharge | null>(null);
  const { openCheckout, loading } = useRazorpayCheckout();
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

      const order = await createBookingOrder({ data: { bookingId } });

      await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        description: "LumoroX Park reservation",
        prefill: { email: user.email ?? undefined },
        notes: { bookingId },
        onSuccess: async (res) => {
          try {
            await verifyPayment({
              data: {
                razorpayOrderId: res.razorpay_order_id ?? order.orderId,
                razorpayPaymentId: res.razorpay_payment_id,
                razorpaySignature: res.razorpay_signature,
                bookingId,
              },
            });
            toast.success("Payment received — your reservation is confirmed");
            window.location.assign("/bookings");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "We could not confirm the payment");
          }
        },
        onDismiss: () => toast.message("Payment cancelled — your slot is held a little longer"),
        onFailure: (message) => toast.error(message),
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
              Parking {formatUsdAsInr(charge.base_amount)} + platform fee{" "}
              {formatUsdAsInr(charge.platform_fee)} + {formatUsdAsInr(charge.reservation_fee)}{" "}
              reservation ={" "}
              <span className="font-semibold text-foreground">
                {formatUsdAsInr(charge.total)}
              </span>
            </div>
          )}
        </div>
        <Button size="sm" onClick={pay} disabled={busy || !charge}>
          <CreditCard className="mr-1 h-4 w-4" />
          {busy ? "Opening…" : charge ? `Pay ${formatUsdAsInr(charge.total)}` : "Pay"}
        </Button>
      </div>
    </div>
  );
}
