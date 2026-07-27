import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Wallet, Clock, Banknote, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MIN_PAYOUT_AMOUNT } from "@/lib/paddle";
import {
  getMyWallet,
  listMyPayouts,
  listMyWalletTransactions,
  requestPayout,
} from "@/lib/earnings";

export const Route = createFileRoute("/_authenticated/host/earnings")({
  head: () => ({
    meta: [
      { title: "Host Earnings & Payouts | LUMORO X PARK" },
      {
        name: "description",
        content:
          "Track your parking earnings, available balance and payout history, and request a bank transfer.",
      },
      { property: "og:title", content: "Host Earnings & Payouts | LUMORO X PARK" },
      {
        property: "og:description",
        content: "Track parking earnings, balance and payouts as a LUMORO X PARK host.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EarningsPage,
});

const money = (n: number) => `$${n.toFixed(2)}`;

function EarningsPage() {
  const qc = useQueryClient();
  const { data: wallet } = useQuery({ queryKey: ["my-wallet"], queryFn: getMyWallet });
  const { data: txns, isLoading: txLoading } = useQuery({
    queryKey: ["my-wallet-txns"],
    queryFn: () => listMyWalletTransactions(50),
  });
  const { data: payouts } = useQuery({ queryKey: ["my-payouts"], queryFn: listMyPayouts });

  const available = wallet?.available_balance ?? 0;

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-5 py-4">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/host"><ArrowLeft className="mr-1 h-4 w-4" />Host</Link>
            </Button>
            <h1 className="font-display text-lg font-bold">Earnings &amp; payouts</h1>
          </div>
          <PayoutDialog
            available={available}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["my-wallet"] });
              qc.invalidateQueries({ queryKey: ["my-payouts"] });
              qc.invalidateQueries({ queryKey: ["my-wallet-txns"] });
            }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-5 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<Wallet className="h-4 w-4" />} label="Available balance" value={money(available)} highlight />
          <Stat icon={<Clock className="h-4 w-4" />} label="Pending payout" value={money(wallet?.pending_payout ?? 0)} />
          <Stat icon={<Banknote className="h-4 w-4" />} label="Paid out" value={money(wallet?.total_paid_out ?? 0)} />
          <Stat icon={<TrendingUp className="h-4 w-4" />} label="Lifetime earnings" value={money(wallet?.lifetime_earnings ?? 0)} />
        </div>

        <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          You keep the space price minus a 10% platform commission. Drivers also pay a $1
          reservation fee that goes to the platform. Balances are paid out automatically on the
          1st of each month once you have at least {money(MIN_PAYOUT_AMOUNT)} available — anything
          below that rolls over.
        </p>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-semibold">Payout requests</h2>
          {!payouts || payouts.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No payouts yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium">{money(p.amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.requested_at).toLocaleDateString()} ·{" "}
                      {p.is_automatic ? "Automatic" : "Requested"}
                      {p.bank_name ? ` · ${p.bank_name}` : ""}
                    </div>
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-semibold">Wallet activity</h2>
          {txLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
          ) : !txns || txns.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Earnings appear here as soon as a driver pays for one of your spaces.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {txns.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium capitalize">{t.kind.replace(/_/g, " ")}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                      {t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={t.amount >= 0 ? "font-semibold text-success" : "font-semibold"}>
                      {t.amount >= 0 ? "+" : "−"}
                      {money(Math.abs(t.amount))}
                    </div>
                    <div className="text-xs text-muted-foreground">bal {money(t.balance_after)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-card ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function PayoutDialog({ available, onDone }: { available: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [accountHolder, setHolder] = useState("");
  const [accountNumber, setNumber] = useState("");
  const [bankCode, setCode] = useState("");
  const [bankName, setBank] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      requestPayout({
        amount: Number(amount),
        accountHolder: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
        bankCode: bankCode.trim(),
        bankName: bankName.trim(),
      }),
    onSuccess: () => {
      toast.success("Payout requested — we'll review it shortly");
      setOpen(false);
      setAmount("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Could not request payout"),
  });

  const canRequest = available >= MIN_PAYOUT_AMOUNT;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={!canRequest}>
          Request payout
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a payout</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="amount">Amount (max {money(available)})</Label>
            <Input
              id="amount"
              type="number"
              min={MIN_PAYOUT_AMOUNT}
              max={available}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(MIN_PAYOUT_AMOUNT)}
            />
          </div>
          <div>
            <Label htmlFor="holder">Account holder</Label>
            <Input id="holder" maxLength={100} value={accountHolder} onChange={(e) => setHolder(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="acct">Account number</Label>
            <Input id="acct" maxLength={40} value={accountNumber} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="code">Bank / routing code</Label>
              <Input id="code" maxLength={30} value={bankCode} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bank">Bank name</Label>
              <Input id="bank" maxLength={80} value={bankName} onChange={(e) => setBank(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              Number(amount) < MIN_PAYOUT_AMOUNT ||
              Number(amount) > available ||
              !accountHolder.trim() ||
              !accountNumber.trim() ||
              !bankName.trim()
            }
          >
            {mutation.isPending ? "Sending…" : "Request payout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
