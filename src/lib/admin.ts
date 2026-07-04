import { supabase } from "@/integrations/supabase/client";

export type ActivityRow = {
  id: string;
  user_id: string;
  action: string;
  reference_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function listMyActivity(limit = 50): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function raiseDispute(bookingId: string, reason: string) {
  const { data, error } = await supabase.rpc("raise_dispute", {
    p_booking_id: bookingId,
    p_reason: reason,
  });
  if (error) throw error;
  return data as string;
}

export type DisputeStatus = "open" | "under_review" | "resolved" | "rejected";

export type MyDispute = {
  id: string;
  booking_id: string;
  reason: string;
  status: DisputeStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export async function listMyDisputesForBooking(bookingId: string): Promise<MyDispute[]> {
  const { data, error } = await supabase
    .from("disputes")
    .select("id, booking_id, reason, status, admin_notes, created_at, updated_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MyDispute[];
}

export type AdminDispute = {
  id: string;
  booking_id: string;
  raised_by: string;
  reason: string;
  status: DisputeStatus;
  admin_notes: string | null;
  created_at: string;
  renter_name: string | null;
  host_name: string | null;
  space_title: string | null;
};

export async function adminListDisputes(): Promise<AdminDispute[]> {
  const { data, error } = await supabase.rpc("admin_list_disputes");
  if (error) throw error;
  return (data ?? []) as AdminDispute[];
}

export async function resolveDispute(id: string, status: DisputeStatus, notes: string) {
  const { error } = await supabase.rpc("resolve_dispute", {
    p_dispute_id: id,
    p_status: status,
    p_notes: notes,
  });
  if (error) throw error;
}

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  open: "Submitted",
  under_review: "Under review",
  resolved: "Resolved",
  rejected: "Rejected",
};

export type AdminStats = {
  users: number;
  spaces: number;
  bookings: number;
  open_disputes: number;
};

export async function adminStats(): Promise<AdminStats | null> {
  const { data, error } = await supabase.rpc("admin_stats");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    users: Number(row.users ?? 0),
    spaces: Number(row.spaces ?? 0),
    bookings: Number(row.bookings ?? 0),
    open_disputes: Number(row.open_disputes ?? 0),
  };
}

export function humanAction(action: string): string {
  const map: Record<string, string> = {
    booking_created: "Reserved a space",
    booking_received: "New booking on your space",
    booking_confirmed: "Booking confirmed",
    booking_active: "Checked in",
    booking_completed: "Stay completed",
    booking_cancelled: "Booking cancelled",
    review_left: "Left a review",
    review_received: "Received a review",
    dispute_raised: "Raised a dispute",
    dispute_resolved: "Dispute resolved",
    dispute_rejected: "Dispute rejected",
  };
  return map[action] ?? action.replace(/_/g, " ");
}
