import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Shield, Users, MapPin, Calendar, AlertTriangle, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  adminListDisputes,
  adminStats,
  isAdmin,
  resolveDispute,
  type AdminDispute,
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

function DisputeRow({ d }: { d: AdminDispute }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<null | "resolved" | "rejected">(null);
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: () => resolveDispute(d.id, open!, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success(`Dispute ${open}`);
      setOpen(null);
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isOpen = d.status === "open";
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
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
            d.status === "resolved" ? "bg-success/10 text-success" :
            d.status === "rejected" ? "bg-muted text-muted-foreground" :
            "bg-warning/10 text-warning"
          }`}>{d.status}</span>
        </TableCell>
        <TableCell>
          {isOpen ? (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setOpen("resolved")}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpen("rejected")}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : d.admin_notes ? (
            <span className="text-xs text-muted-foreground line-clamp-1" title={d.admin_notes}>{d.admin_notes}</span>
          ) : null}
        </TableCell>
      </TableRow>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{open === "resolved" ? "Resolve dispute" : "Reject dispute"}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Admin notes (visible to involved parties)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
