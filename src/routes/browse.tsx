import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, SlidersHorizontal, Loader2, ArrowLeft, Crosshair, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SpacePhoto } from "@/components/SpacePhoto";
import { searchSpaces, type SpaceResult } from "@/lib/search";
import { MapFrame } from "@/components/MapFrame";
import { markPerf, startPerfTimer } from "@/lib/perf";

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
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);

  const [covered, setCovered] = useState(false);
  const [gated, setGated] = useState(false);
  const [ev, setEv] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const [radius, setRadius] = useState("10");

  // geolocate — failures are reported, never fatal: we keep the default centre.
  const locate = useCallback((manual = false) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocating(false);
      setGeoError("This browser can't share your location. Showing New York — pan the map to your area.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    const done = startPerfTimer("geolocation");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        done({ ok: true });
        setCenter({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
        if (manual) toast.success("Centred on your location");
      },
      (err) => {
        done({ ok: false, code: err.code });
        markPerf("geolocation_error", { code: err.code, message: err.message });
        setLocating(false);
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location access is blocked, so we're showing New York. Allow location in your browser, or pan the map."
            : err.code === err.TIMEOUT
              ? "Getting your location timed out. Showing the last area — try again or pan the map."
              : "We couldn't work out where you are. Showing New York — pan the map to your area.";
        setGeoError(message);
        if (manual) toast.error(message);
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

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
    <div className="min-h-full bg-gradient-surface">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="shrink-0 px-2 sm:px-3">
              <Link to="/"><ArrowLeft className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Home</span></Link>
            </Button>
            <h1 className="truncate font-display text-base font-bold sm:text-lg">Find a spot</h1>
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="mr-1 h-4 w-4" /> Filters
          </Button>
        </div>
        {showFilters && (
          <div className="mx-auto max-w-6xl border-t border-border/60 px-4 py-4 sm:px-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
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
            <div className="flex items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Button size="sm" variant="ghost" onClick={() => locate(true)} disabled={locating}>
                <Crosshair className="mr-1 h-3.5 w-3.5" /> My location
              </Button>
            </div>
          </div>
          {geoError && (
            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="flex-1">{geoError}</span>
              <button className="font-medium text-primary hover:underline" onClick={() => locate(true)}>
                Retry
              </button>
            </div>
          )}
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
                      <div className="flex min-w-0 items-center gap-1.5">
                        <div className="truncate font-semibold">{s.title}</div>
                        {s.is_featured && (
                          <span className="shrink-0 rounded-full bg-gradient-brand px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                            Pro
                          </span>
                        )}
                      </div>
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
          <MapFrame height={520} retryKey={mapKey} onRetry={() => setMapKey((k) => k + 1)}>
            <BrowseMap
              center={center}
              spaces={results}
              selectedId={selected}
              onSelect={(id) => navigate({ to: "/space/$id", params: { id } })}
              onCenterChange={setCenter}
              height={520}
            />
          </MapFrame>
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
