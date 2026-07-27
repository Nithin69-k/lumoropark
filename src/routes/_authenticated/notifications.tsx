import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Bell, Check, MessageSquare, Calendar, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listNotifications, markAllRead, type Notification } from "@/lib/inbox";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function iconFor(kind: string) {
  if (kind === "message") return MessageSquare;
  if (kind.startsWith("booking")) return Calendar;
  return CircleAlert;
}

function NotificationsPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const rows = await listNotifications();
      setItems(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel(`notif:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user.id]);

  async function handleMarkAll() {
    try {
      await markAllRead();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="min-h-full bg-gradient-surface">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/profile"><ArrowLeft className="mr-1 h-4 w-4" />Profile</Link>
            </Button>
            <h1 className="font-display text-lg font-bold flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleMarkAll}>
            <Check className="mr-1 h-4 w-4" /> Mark all read
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8">
        {loading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            You're all caught up.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const Icon = iconFor(n.kind);
              const unread = !n.read_at;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => n.link && navigate({ to: n.link })}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                      unread ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                    } hover:bg-accent`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{n.title}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                        {n.body && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                        )}
                      </div>
                      {unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
