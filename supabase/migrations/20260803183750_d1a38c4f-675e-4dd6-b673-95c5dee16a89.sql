-- 1) Internal helpers must not be callable through the Data API
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_booking_party(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.users_share_booking(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancellation_cutoff_hours(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_pending_bookings() FROM anon, authenticated;

-- 2) profile_contacts: exactly one SELECT policy governs phone visibility
DROP POLICY IF EXISTS "Owner manages own phone" ON public.profile_contacts;
DROP POLICY IF EXISTS "Booking counterparties view phone" ON public.profile_contacts;

CREATE POLICY "Own or booking counterparty phone visible"
  ON public.profile_contacts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.users_share_booking(auth.uid(), user_id));

CREATE POLICY "Owner inserts own phone"
  ON public.profile_contacts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner updates own phone"
  ON public.profile_contacts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner deletes own phone"
  ON public.profile_contacts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);