-- RLS policies on profiles, bookings, messages, payouts, wallets, tickets and
-- roles call these helpers. Postgres evaluates the policy as the *calling*
-- role, so `authenticated` must be able to EXECUTE them or every read fails
-- with 42501 "permission denied for function ...".
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_booking_party(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_share_booking(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_share_active_booking(uuid, uuid) TO authenticated;

-- Anonymous visitors have no policies referencing these; keep them revoked.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_booking_party(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.users_share_booking(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.users_share_active_booking(uuid, uuid) FROM anon, public;