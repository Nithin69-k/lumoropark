import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar, MapPin, CheckCircle2, Clock, LogOut, Star, AlertTriangle, MessageSquare, Gavel, XCircle } from "lucide-react";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QrCodeImage } from "@/components/QrCodeImage";
import { listMyBookings, type MyBooking } from "@/lib/search";
import { checkoutBooking, submitReview, hasReviewedBooking } from "@/lib/lifecycle";
import { raiseDispute, listMyDisputesForBooking, DISPUTE_STATUS_LABEL, type MyDispute, type DisputeStatus } from "@/lib/admin";

const searchSchema = z.object({ new: z.string().optional() });

export const Route = createFileRoute("/_authenticated/bookings")({
  validateSearch: (s) => searchSchema.parse(s),
  component: BookingsPage,
});

function BookingsPage() {
  const search = Route.useSearch();
  const [items, setItems] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});

  async function refresh() {
    try {
      const rows = await listMyBookings();
      setItems(rows);
      const completed = rows.filter((r) => r.status === "completed");
      const flags = await Promise.all(completed.map((r) => hasReviewedBooking(r.id)));
      const map: Record<string, boolean> = {};
      completed.forEach((r, i) => (map[r.id] = flags[i]));
      setReviewed(map);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <div className="text-muted-foreground">Show the QR code on arrival — your host scans it to check you in.</div>
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
          <ul className="space-y-4">
            {items.map((b) => (
              <BookingCard
                key={b.id}
                b={b}
                alreadyReviewed={!!reviewed[b.id]}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function BookingCard({
  b,
  alreadyReviewed,
  onChanged,
}: {
  b: MyBooking;
  alreadyReviewed: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleCheckout() {
    setBusy(true);
    try {
      await checkoutBooking(b.id);
      toast.success("Checked out");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-5 shadow-card">
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

      {(b.status === "pending" || b.status === "confirmed") && b.qr_checkin_code && (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:gap-4">
          <QrCodeImage value={b.qr_checkin_code} size={140} />
          <div className="text-center sm:text-left">
            <div className="text-sm font-medium">Show this at arrival</div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">{b.qr_checkin_code}</div>
            <p className="mt-2 text-xs text-muted-foreground">Your host will scan or type this code to check you in.</p>
          </div>
        </div>
      )}

      {b.status === "active" && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-success/30 bg-success/5 p-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>Checked in — enjoy your stay</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleCheckout} disabled={busy}>
            <LogOut className="mr-1 h-4 w-4" /> {busy ? "…" : "Check out"}
          </Button>
        </div>
      )}

      {b.status === "completed" && !alreadyReviewed && (
        <ReviewForm bookingId={b.id} onSubmitted={onChanged} />
      )}
      {b.status === "completed" && alreadyReviewed && (
        <div className="mt-3 text-xs text-muted-foreground">Thanks for reviewing this stay.</div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/messages/$bookingId" params={{ bookingId: b.id }}>
            <MessageSquare className="mr-1 h-4 w-4" /> Message
          </Link>
        </Button>
        <ReportDialog bookingId={b.id} />
      </div>
    </li>
  );
}

function ReportDialog({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (reason.trim().length < 5) {
      toast.error("Please describe the issue (5+ characters)");
      return;
    }
    setBusy(true);
    try {
      await raiseDispute(bookingId, reason.trim());
      toast.success("Report sent — our team will review it");
      setOpen(false);
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Report an issue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an issue with this booking</DialogTitle>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What went wrong? (spot unavailable, damage, no-show, etc.)"
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewForm({ bookingId, onSubmitted }: { bookingId: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    try {
      await submitReview(bookingId, rating, comment.trim());
      toast.success("Review submitted");
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="text-sm font-medium">Rate your stay</div>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
            <Star
              className={`h-6 w-6 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="How was the spot? (optional)"
        rows={2}
        className="mt-3"
      />
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={handleSubmit} disabled={busy}>
          {busy ? "Submitting…" : "Submit review"}
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status, payment }: { status: string; payment: string }) {
  const label =
    status === "active" ? "Active" :
    status === "completed" ? "Completed" :
    payment === "pending" ? "Reserved" : status;
  const tone =
    status === "active" ? "bg-success/10 text-success" :
    status === "completed" ? "bg-muted text-muted-foreground" :
    "bg-warning/10 text-warning";
  return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
