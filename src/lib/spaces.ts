import { supabase } from "@/integrations/supabase/client";

export type MySpace = {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  price_per_hour: number;
  price_per_day: number | null;
  is_active: boolean;
  live_occupancy_status: string;
  photos: string[];
  created_at: string;
};

export type CreateSpaceInput = {
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  price_per_hour: number;
  price_per_day: number | null;
  vehicle_types: string[];
  is_covered: boolean;
  is_gated: boolean;
  has_ev_charging: boolean;
  has_camera: boolean;
  has_sensor: boolean;
  photos: string[];
};

export async function createSpace(input: CreateSpaceInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_parking_space", {
    p_title: input.title,
    p_description: input.description,
    p_address: input.address,
    p_lat: input.lat,
    p_lng: input.lng,
    p_price_per_hour: input.price_per_hour,
    p_price_per_day: input.price_per_day as number,
    p_vehicle_types: input.vehicle_types,
    p_is_covered: input.is_covered,
    p_is_gated: input.is_gated,
    p_has_ev_charging: input.has_ev_charging,
    p_has_camera: input.has_camera,
    p_has_sensor: input.has_sensor,
    p_photos: input.photos,
  });
  if (error) throw error;
  return data as string;
}

export async function listMySpaces(): Promise<MySpace[]> {
  const { data, error } = await supabase.rpc("list_my_spaces");
  if (error) throw error;
  return (data ?? []) as MySpace[];
}

export async function toggleSpaceActive(id: string, isActive: boolean) {
  const { error } = await supabase
    .from("parking_spaces")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
}

export async function uploadSpacePhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("space-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function signedPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("space-photos")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export type Slot = {
  id: string;
  space_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
};

export async function listSlots(spaceId: string): Promise<Slot[]> {
  const { data, error } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("space_id", spaceId)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Slot[];
}

export async function addSlot(spaceId: string, startIso: string, endIso: string) {
  const { error } = await supabase
    .from("availability_slots")
    .insert({ space_id: spaceId, start_time: startIso, end_time: endIso });
  if (error) throw error;
}

export async function deleteSlot(id: string) {
  const { error } = await supabase.from("availability_slots").delete().eq("id", id);
  if (error) throw error;
}
