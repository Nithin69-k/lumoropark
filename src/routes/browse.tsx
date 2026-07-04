import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, SlidersHorizontal, Loader2, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SpacePhoto } from "@/components/SpacePhoto";
import { searchSpaces, type SpaceResult } from "@/lib/search";

const BrowseMap = lazy(() =>
  import("@/components/BrowseMap").then((m) => ({ default: m.BrowseMap })),
);

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: [
      { title: "Browse parking near you — LumoroX Park" },
      { name: "description", content: "Find private driveways and parking spots by the hour with live availability." },
      { property: "og:title", content: "Browse parking near you — LumoroX Park" },
      { property: "og:description", content: "Find private driveways and parking spots by the hour with live availability." },
    ],
  }),
  component: BrowsePage,
});

function BrowsePage() {
  const navigate = useNavigate();
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 40.7128, lng: -74.006 });
  const [locating, setLocating] = useState(true);
  const [results, setResults] = useState<SpaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [covered, setCovered] = useState(false);
  const [gated, setGated] = useState(false);
  const [ev, setEv] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const [radius, setRadius] = useState("10");

  // geolocate
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCenter({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 6000 },
    );
  }, []);

  // search on center or filters change (debounced)
  useEffect(() => {
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchSpaces({
          lat: center.lat,
          lng: center.lng,
          radiusKm: parseFloat(radius) || 10,
          covered: covered || undefined,
          gated: gated || undefined,
          ev: ev || undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        });
        setResults(rows);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [center.lat, center.lng, radius, covered, gated, ev, maxPrice]);

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" />Home</Link>
            </Button>
            <h1 className="font-display text-lg font-bold">Find a spot</h1>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="mr-1 h-4 w-4" /> Filters
          </Button>
        </div>
        {showFilters && (
          <div className="mx-auto max-w-6xl border-t border-border/60 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <FilterCheck label="Covered" checked={covered} onChange={setCovered} />
              <FilterCheck label="Gated" checked={gated} onChange={setGated} />
              <FilterCheck label="EV charging" checked={ev} onChange={setEv} />
              <div>
                <Label htmlFor="mp" className="text-xs">Max $/hr</Label>
                <Input id="mp" type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="any" />
              </div>
              <div>
                <Label htmlFor="rd" className="text-xs">Radius (km)</Label>
                <Input id="rd" type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-6 md:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {locating ? "Locating…" : loading ? "Searching…" : `${results.length} spots nearby`}
            </span>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          {results.length === 0 && !loading && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No spots in this area yet. Try widening the radius or panning the map.
            </div>
          )}
          <ul className="space-y-3">
            {results.map((s) => (
              <li
                key={s.id}
                className={`overflow-hidden rounded-2xl border bg-card shadow-card transition-colors ${
                  selected === s.id ? "border-primary" : "border-border"
                }`}
              >
                <button
                  className="flex w-full gap-3 p-3 text-left"
                  onClick={() => navigate({ to: "/space/$id", params: { id: s.id } })}
                  onMouseEnter={() => setSelected(s.id)}
                >
                  <div className="h-20 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                    {s.photos[0] ? (
                      <SpacePhoto path={s.photos[0]} alt={s.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <MapPin className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="truncate font-semibold">{s.title}</div>
                      <div className="whitespace-nowrap text-sm font-semibold text-primary">
                        ${s.price_per_hour}/hr
                      </div>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{s.address}</div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <span>{s.distance_km.toFixed(1)} km</span>
                      {s.is_covered && <span>· Covered</span>}
                      {s.is_gated && <span>· Gated</span>}
                      {s.has_ev_charging && <span>· EV</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:sticky md:top-4 md:self-start">
          <Suspense fallback={<div className="h-[420px] animate-pulse rounded-2xl bg-muted" />}>
            <BrowseMap
              center={center}
              spaces={results}
              selectedId={selected}
              onSelect={(id) => navigate({ to: "/space/$id", params: { id } })}
              onCenterChange={setCenter}
              height={520}
            />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function FilterCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>{label}</span>
    </label>
  );
}
