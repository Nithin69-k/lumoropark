import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Activity as ActivityIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { listMyActivity, humanAction } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityFeed,
});

function ActivityFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-activity"],
    queryFn: () => listMyActivity(100),
  });

  return (
    <div className="min-h-screen bg-gradient-surface">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/profile"><ArrowLeft className="mr-1 h-4 w-4" />Profile</Link>
          </Button>
          <h1 className="font-display text-lg font-bold">Activity</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <ActivityIcon className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">No activity yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your bookings, reviews, and updates will appear here.</p>
          </div>
        ) : (
          <ol className="relative space-y-3 border-l border-border pl-6">
            {data.map((row) => (
              <li key={row.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-sm">{humanAction(row.action)}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {row.metadata && Object.keys(row.metadata).length > 0 && (
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
