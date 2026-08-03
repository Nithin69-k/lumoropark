
-- 1. Time-scoped counterparty phone visibility
CREATE OR REPLACE FUNCTION public.users_share_active_booking(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE ((b.renter_id = _a AND b.host_id = _b) OR (b.host_id = _a AND b.renter_id = _b))
      AND b.status IN ('pending','confirmed','active','checked_in','completed')
      AND b.cancelled_at IS NULL
      AND b.end_time > (now() - interval '7 days')
  )
$$;

REVOKE ALL ON FUNCTION public.users_share_active_booking(uuid, uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Own or booking counterparty phone visible" ON public.profile_contacts;
CREATE POLICY "Own or active booking counterparty phone visible"
ON public.profile_contacts
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.users_share_active_booking(auth.uid(), user_id)
);

-- 2. Lock down demo data helpers
REVOKE ALL ON FUNCTION public.seed_demo_data() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_demo_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_data() TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO service_role;
