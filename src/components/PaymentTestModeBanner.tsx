import { getPaymentEnvironment } from "@/lib/razorpay";

export function PaymentTestModeBanner() {
  if (getPaymentEnvironment() !== "sandbox") return null;

  return (
    <div className="w-full border-b border-warning/40 bg-warning/10 px-4 py-2 text-center text-xs text-foreground">
      Payments are in test mode — no real money moves. Use card 4111 1111 1111 1111 with any
      future expiry and CVV, or UPI id <span className="font-medium">success@razorpay</span>.
    </div>
  );
}
