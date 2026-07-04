import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Shield, Star, Pencil, LogOut, Car, Home, Bell, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyProfile, updateMyProfile, trustBand, type Profile } from "@/lib/profile";
import { humanAction, isAdmin, listMyActivity } from "@/lib/admin";
import { unreadCount } from "@/lib/inbox";
import { listMyBookings } from "@/lib/search";
import { listMyReviews } from "@/lib/lifecycle";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: () => fetchMyProfile(user.id),
  });

  const { data: admin } = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: () => isAdmin(user.id),
  });

  const { data: unread = 0 } = useQuery({
    queryKey: ["notif-unread", user.id],
    queryFn: () => unreadCount(),
    refetchInterval: 30000,
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-gradient-surface px-4 py-12">
        <div className="mx-auto max-w-2xl animate-pulse">
          <div className="h-8 w-40 rounded bg-muted" />
          <div className="mt-6 h-48 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  const initials = (profile.full_name ?? user.email ?? "?")
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const band = trustBand(profile.trust_score);
  const toneClass =
    band.tone === "success"
      ? "bg-success/15 text-success-foreground border-success/30"
      : band.tone === "warning"
        ? "bg-warning/15 text-warning-foreground border-warning/30"
        : band.tone === "destructive"
          ? "bg-destructive/15 text-destructive border-destructive/30"
          : "bg-muted text-muted-foreground border-border";

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="inline-block h-6 w-6 rounded-md bg-gradient-brand shadow-glow" />
            LumoroX Park
          </Link>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" className="relative">
              <Link to="/notifications" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Messages">
              <Link to="/messages"><MessageSquare className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.full_name ?? ""} />
                <AvatarFallback className="bg-gradient-brand text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">{profile.full_name || "Unnamed"}</h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    {Number(profile.rating).toFixed(1)}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    {profile.is_host ? <Home className="h-3 w-3" /> : <Car className="h-3 w-3" />}
                    {profile.is_host ? "Host + renter" : "Renter"}
                  </Badge>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
              <Pencil className="mr-2 h-4 w-4" />
              {editing ? "Close" : "Edit profile"}
            </Button>
          </div>

          <div className={`mt-6 rounded-2xl border p-5 ${toneClass}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium opacity-80">
                  <Shield className="h-4 w-4" /> Trust score
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-bold">{profile.trust_score}</span>
                  <span className="text-sm opacity-70">/ 100</span>
                  <span className="ml-2 rounded-full border border-current/30 bg-background/40 px-2 py-0.5 text-xs font-semibold">
                    {band.label}
                  </span>
                </div>
              </div>
              <div className="text-right text-xs opacity-70">
                <div>{profile.total_bookings} bookings</div>
                <div>Earn +1 for every on-time completion.</div>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/40">
              <div
                className="h-full rounded-full bg-current transition-all"
                style={{ width: `${Math.max(4, Math.min(100, profile.trust_score))}%` }}
              />
            </div>
          </div>

          {editing && <EditForm profile={profile} onClose={() => setEditing(false)} />}
        </div>

        <HistoryTabs userId={user.id} />

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border p-5 text-sm">
            <strong className="block text-foreground">Bookings</strong>
            <p className="mt-2 text-muted-foreground">Your reservations, QR check-ins, and history.</p>
            <Button asChild size="sm" className="mt-3">
              <Link to="/bookings">View my bookings</Link>
            </Button>
          </div>
          <div className="rounded-2xl border border-border p-5 text-sm">
            <strong className="block text-foreground">Your listings</strong>
            {profile.is_host ? (
              <div className="mt-2">
                <p className="text-muted-foreground">Manage your parking spaces and availability.</p>
                <Button asChild size="sm" className="mt-3">
                  <Link to="/host">Open host dashboard</Link>
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-muted-foreground">Flip the host toggle to start listing spaces.</p>
            )}
          </div>
          <div className="rounded-2xl border border-border p-5 text-sm">
            <strong className="block text-foreground">Activity</strong>
            <p className="mt-2 text-muted-foreground">Timeline of your bookings, reviews, and updates.</p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link to="/activity">View activity</Link>
            </Button>
          </div>
          {admin && (
            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 text-sm">
              <strong className="block text-foreground">Admin</strong>
              <p className="mt-2 text-muted-foreground">Platform stats and dispute resolution.</p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/admin">Open admin</Link>
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function EditForm({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [isHost, setIsHost] = useState(profile.is_host);
  const [busy, setBusy] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateMyProfile(profile.id, {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        is_host: isHost,
      });
      qc.invalidateQueries({ queryKey: ["profile", profile.id] });
      toast.success("Profile updated");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-6 space-y-4 border-t border-border pt-6">
      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <div>
          <Label htmlFor="hostToggle" className="text-sm">
            List my parking spaces
          </Label>
          <p className="text-xs text-muted-foreground">Enable host features.</p>
        </div>
        <Switch id="hostToggle" checked={isHost} onCheckedChange={setIsHost} />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
