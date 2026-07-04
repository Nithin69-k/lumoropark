import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_host: boolean;
  rating: number;
  total_bookings: number;
  trust_score: number;
  created_at: string;
  updated_at: string;
};

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function updateMyProfile(
  userId: string,
  patch: Partial<Pick<Profile, "full_name" | "phone" | "is_host" | "avatar_url">>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

export function trustBand(score: number): {
  label: string;
  tone: "success" | "warning" | "destructive" | "muted";
} {
  if (score >= 90) return { label: "Excellent", tone: "success" };
  if (score >= 70) return { label: "Trusted", tone: "success" };
  if (score >= 50) return { label: "Building", tone: "warning" };
  if (score >= 30) return { label: "At risk", tone: "warning" };
  return { label: "Low trust", tone: "destructive" };
}
