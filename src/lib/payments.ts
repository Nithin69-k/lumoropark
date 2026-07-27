import { supabase } from "@/integrations/supabase/client";

export type BookingCharge = {
  base_amount: number;
  platform_fee: number;
  reservation_fee: number;
  total: number;
  credits: number;
};

export async function getBookingCharge(bookingId: string): Promise<BookingCharge> {
  const { data, error } = await supabase.rpc("get_booking_charge", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as BookingCharge | undefined;
  if (!row) throw new Error("Could not price this booking");
  return {
    base_amount: Number(row.base_amount),
    platform_fee: Number(row.platform_fee),
    reservation_fee: Number(row.reservation_fee),
    total: Number(row.total),
    credits: Number(row.credits),
  };
}
