import { createFileRoute } from "@tanstack/react-router";
import { RazorpayCheckoutButton } from "@/components/RazorpayCheckoutButton";

export const Route = createFileRoute("/pay")({
  component: PayDemo,
  head: () => ({
    meta: [
      { title: "Test payment — LumoroX Park" },
      { name: "description", content: "Razorpay test checkout page." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PayDemo() {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-surface p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card space-y-4">
        <h1 className="font-display text-2xl font-bold">Razorpay test checkout</h1>
        <p className="text-sm text-muted-foreground">
          Click below to open the Razorpay modal in test mode. Use card
          <code className="mx-1 rounded bg-muted px-1">4111 1111 1111 1111</code>
          with any future expiry and any CVV.
        </p>
        <RazorpayCheckoutButton amount={49900} description="Test order" />
      </div>
    </div>
  );
}
