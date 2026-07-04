import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar, MapPin, QrCode, CheckCircle2, Clock } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { listMyBookings, type MyBooking } from "@/lib/search";

const searchSchema = z.object({ new: z.string().optional() });

export const Route = createFileRoute("/_authenticated/bookings")({
  validateSearch: (s) => searchSchema.parse(s),
  component: BookingsPage,
});

function BookingsPage() {
  const search = Route.useSearch();
  const [items, setItems] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setItems(await listMyBookings());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load bookings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/profile"><ArrowLeft className="mr-1 h-4 w-4" />Profile</Link>
            </Button>
            <h1 className="font-display text-lg font-bold">My bookings</h1>
          </div>
          <Button asChild size="sm"><Link to="/browse">Find a spot</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-6">
        {search.new && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">Reservation created</div>
              <div className="text-muted-foreground">Payment will be enabled once your host confirms Stripe.</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">No bookings yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Reserve your first parking spot to see it here.</p>
            <Button asChild className="mt-4"><Link to="/browse">Browse spots</Link></Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((b) => (
              <li key={b.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to="/space/$id" params={{ id: b.space_id }} className="text-lg font-semibold hover:underline">
                      {b.space_title}
                    </Link>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{b.space_address}
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {fmt(b.start_time)} → {fmt(b.end_time)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">${b.total_price.toFixed(2)}</div>
                    <StatusBadge status={b.status} payment={b.payment_status} />
                  </div>
                </div>
                {b.qr_checkin_code && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-mono">
                    <QrCode className="h-3 w-3" /> {b.qr_checkin_code}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status, payment }: { status: string; payment: string }) {
  const label = payment === "pending" ? "Awaiting payment" : status;
  const tone = payment === "paid" ? "bg-success/10 text-success" : payment === "pending" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground";
  return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${tone}`}>{label}</span>;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
