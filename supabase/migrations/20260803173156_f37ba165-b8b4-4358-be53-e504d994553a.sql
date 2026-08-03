CREATE OR REPLACE FUNCTION public.get_booking_charge(p_booking_id uuid, p_env text DEFAULT 'live'::text)
 RETURNS TABLE(base_amount numeric, platform_fee numeric, reservation_fee numeric, total numeric, credits integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE b public.bookings; v_base numeric; v_fee numeric; v_res numeric := 1; v_rate numeric;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF b.renter_id <> auth.uid() THEN RAISE EXCEPTION 'Not your booking'; END IF;
  v_base := round(b.total_price::numeric, 2);
  v_rate := public.host_commission_rate(b.host_id, p_env);
  v_fee := round(v_base * v_rate, 2);
  -- Payments are now created as a single custom-amount transaction, so the
  -- old whole-dollar credit rounding and the $500 ceiling no longer apply.
  RETURN QUERY SELECT v_base, v_fee, v_res, round(v_base + v_fee + v_res, 2), GREATEST(1, ceil(v_base + v_fee)::integer);
END; $function$;

REVOKE ALL ON FUNCTION public.get_booking_charge(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_charge(uuid, text) TO authenticated;