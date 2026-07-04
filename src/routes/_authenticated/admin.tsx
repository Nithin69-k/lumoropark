import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Shield, Users, MapPin, Calendar, AlertTriangle, Check, X, Gavel, DollarSign, ShieldCheck, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DISPUTE_STATUS_LABEL,
  adminListDisputes,
  adminStats,
  isAdmin,
  resolveDispute,
  type AdminDispute,
  type DisputeStatus,
} from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user } = Route.useRouteContext();
  const { data: admin, isLoading: checking } = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: () => isAdmin(user.id),
  });

  if (checking) {
    return <div className="min-h-screen bg-gradient-surface p-8 text-sm text-muted-foreground">Checking access…</div>;
  }

  if (!admin) {
    return (
      <div className="min-h-screen bg-gradient-surface px-5 py-16">
        <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-card">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your account doesn't have admin access.</p>
          <Button asChild className="mt-6"><Link to="/profile">Back to profile</Link></Button>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: adminStats });
  const { data: disputes, isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: adminListDisputes,
  });

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/profile"><ArrowLeft className="mr-1 h-4 w-4" />Profile</Link>
          </Button>
          <h1 className="font-display text-lg font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Admin
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6 space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Users className="h-4 w-4" />} label="Users" value={stats?.users ?? 0} />
          <StatCard icon={<MapPin className="h-4 w-4" />} label="Spaces" value={stats?.spaces ?? 0} />
          <StatCard icon={<Calendar className="h-4 w-4" />} label="Bookings" value={stats?.bookings ?? 0} />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Open disputes"
            value={stats?.open_disputes ?? 0}
            tone={stats && stats.open_disputes > 0 ? "warning" : undefined}
          />
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Disputes</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading…</div>
            ) : !disputes || disputes.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No disputes yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Space</TableHead>
                    <TableHead>Renter</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes.map((d) => (
                    <DisputeRow key={d.id} d={d} />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "warning";
}) {
  return (
    <div className={`rounded-2xl border p-5 ${tone === "warning" ? "border-warning/40 bg-warning/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

function statusTone(s: DisputeStatus): string {
  switch (s) {
    case "resolved": return "bg-success/10 text-success";
    case "rejected": return "bg-muted text-muted-foreground";
    case "under_review": return "bg-primary/10 text-primary";
    default: return "bg-warning/10 text-warning";
  }
}

function DisputeRow({ d }: { d: AdminDispute }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<DisputeStatus | null>(null);
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mut = useMutation({
    mutationFn: () => resolveDispute(d.id, target!, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success(`Marked ${DISPUTE_STATUS_LABEL[target!].toLowerCase()}`);
      setTarget(null);
      setNotes("");
      setConfirmOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canReview = d.status === "open";
  const canResolve = d.status === "open" || d.status === "under_review";
  const requiresNotes = target === "resolved" || target === "rejected";

  return (
    <>
      <TableRow>
        <TableCell className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
        </TableCell>
        <TableCell>{d.space_title ?? "—"}</TableCell>
        <TableCell>{d.renter_name ?? "—"}</TableCell>
        <TableCell>{d.host_name ?? "—"}</TableCell>
        <TableCell className="max-w-xs truncate" title={d.reason}>{d.reason}</TableCell>
        <TableCell>
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(d.status)}`}>
            {DISPUTE_STATUS_LABEL[d.status]}
          </span>
        </TableCell>
        <TableCell>
          {canResolve ? (
            <div className="flex flex-wrap gap-1">
              {canReview && (
                <Button size="sm" variant="outline" onClick={() => setTarget("under_review")}>
                  <Gavel className="mr-1 h-3.5 w-3.5" /> Review
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { setTarget("resolved"); setNotes(""); }}>
                <Check className="mr-1 h-3.5 w-3.5" /> Resolve
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setTarget("rejected"); setNotes(""); }}>
                <X className="mr-1 h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          ) : d.admin_notes ? (
            <span className="text-xs text-muted-foreground line-clamp-1" title={d.admin_notes}>{d.admin_notes}</span>
          ) : null}
        </TableCell>
      </TableRow>

      {/* Notes dialog (only for resolve/reject) */}
      <Dialog
        open={target !== null && requiresNotes && !confirmOpen}
        onOpenChange={(o) => { if (!o) { setTarget(null); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target === "resolved" ? "Resolve dispute" : "Reject dispute"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Add a note explaining the outcome — the renter and host will both see it.
          </p>
          <Textarea
            placeholder="Admin notes (min 5 characters)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={notes.trim().length < 5}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation prompt */}
      <AlertDialog
        open={target !== null && (requiresNotes ? confirmOpen : true)}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmOpen(false);
            if (!requiresNotes) setTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target === "under_review" && "Move this dispute to under review?"}
              {target === "resolved" && "Confirm resolution"}
              {target === "rejected" && "Confirm rejection"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target === "under_review"
                ? "The renter will be notified that an admin is looking into it. You can still resolve or reject afterward."
                : target === "resolved"
                  ? "This closes the dispute in the renter's favour and posts your note to both parties."
                  : "This closes the dispute without action. Both parties will see your note."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
