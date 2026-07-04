import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MapPin, ShieldCheck, Zap, Camera, Home, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpacePhoto } from "@/components/SpacePhoto";
import { supabase } from "@/integrations/supabase/client";
import { getSpaceDetail, createPendingBooking, type SpaceDetail } from "@/lib/search";
import { trustBand } from "@/lib/profile";

const MapPicker = lazy(() =>
  import("@/components/MapPicker").then((m) => ({ default: m.MapPicker })),
);

export const Route = createFileRoute("/space/$id")({
  component: SpacePage,
});

function SpacePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<SpaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  const now = new Date();
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const [start, setStart] = useState(toLocalInput(in1h));
  const [end, setEnd] = useState(toLocalInput(in3h));
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await getSpaceDetail(id);
        if (!alive) return;
        setDetail(d);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load listing");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const hours = (() => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
    return (e - s) / 3600000;
  })();
  const estimated = detail ? Math.round(hours * detail.price_per_hour * 100) / 100 : 0;

  async function handleBook() {
    if (!detail) return;
    if (!signedIn) {
      navigate({ to: "/auth", search: { mode: "signin" } });
      return;
    }
    if (hours <= 0) {
      toast.error("End time must be after start time");
      return;
    }
    setBooking(true);
    try {
      const bookingId = await createPendingBooking(
        detail.id,
        new Date(start).toISOString(),
        new Date(end).toISOString(),
      );
      toast.success("Booking created");
      navigate({ to: "/bookings", search: { new: bookingId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBooking(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-surface">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-surface p-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold">Listing not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">It may have been removed or paused.</p>
          <Button asChild className="mt-4"><Link to="/browse">Back to browse</Link></Button>
        </div>
      </div>
    );
  }

  const band = trustBand(detail.host_trust_score);

  return (
    <div className="min-h-screen bg-gradient-surface pb-16">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/browse"><ArrowLeft className="mr-1 h-4 w-4" />Back</Link>
          </Button>
          <div className="text-sm text-muted-foreground">{detail.live_occupancy_status === "available" ? "Available now" : detail.live_occupancy_status}</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6">
        {/* Photos */}
        <div className="grid gap-2 md:grid-cols-3">
          {(detail.photos.length ? detail.photos : [null]).slice(0, 3).map((p, i) => (
            <div key={i} className={`overflow-hidden rounded-2xl bg-muted ${i === 0 ? "md:col-span-2 md:row-span-2 aspect-video" : "aspect-square"}`}>
              {p ? (
                <SpacePhoto path={p} alt={detail.title} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-muted-foreground">
                  <MapPin className="h-8 w-8" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h1 className="font-display text-3xl font-bold">{detail.title}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {detail.address}
            </div>

            {detail.description && (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {detail.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {detail.is_covered && <Chip icon={Home}>Covered</Chip>}
              {detail.is_gated && <Chip icon={ShieldCheck}>Gated</Chip>}
              {detail.has_ev_charging && <Chip icon={Zap}>EV charger</Chip>}
              {detail.has_camera && <Chip icon={Camera}>Camera</Chip>}
              {detail.vehicle_types.map((v) => (
                <span key={v} className="rounded-full border border-border px-3 py-1 capitalize text-muted-foreground">
                  {v}
                </span>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-brand text-sm font-semibold text-primary-foreground">
                  {(detail.host_name ?? "H").slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">Hosted by {detail.host_name ?? "a LumoroX host"}</div>
                  <div className="text-xs text-muted-foreground">
                    Trust score {detail.host_trust_score} · {band.label} · ★ {detail.host_rating.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
                <MapPicker value={{ lat: detail.lat, lng: detail.lng }} onChange={() => {}} height={260} />
              </Suspense>
            </div>
          </div>

          {/* Booking card */}
          <aside className="md:sticky md:top-4 md:self-start">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-3xl font-bold">${detail.price_per_hour}</div>
                  <div className="text-xs text-muted-foreground">per hour</div>
                </div>
                {detail.price_per_day && (
                  <div className="text-right text-sm text-muted-foreground">or ${detail.price_per_day}/day</div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="s">Start</Label>
                  <Input id="s" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="e">End</Label>
                  <Input id="e" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">{hours > 0 ? `${hours.toFixed(1)} hours` : "—"}</span>
                <span className="font-semibold">${estimated.toFixed(2)}</span>
              </div>

              <Button className="mt-4 w-full" size="lg" onClick={handleBook} disabled={booking}>
                {booking ? "Reserving…" : signedIn ? "Reserve" : "Sign in to reserve"}
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                You won't be charged yet — payment is confirmed at checkout.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1">
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
