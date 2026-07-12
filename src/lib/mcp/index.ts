import { auth, defineMcp } from "@lovable.dev/mcp-js";

import createBooking from "./tools/create-booking";
import listMyBookings from "./tools/list-my-bookings";
import listMySpaces from "./tools/list-my-spaces";
import listNotifications from "./tools/list-notifications";
import raiseDispute from "./tools/raise-dispute";
import searchSpaces from "./tools/search-spaces";

// The OAuth issuer must be the direct Supabase host, not the .lovable.cloud proxy.
// Vite inlines VITE_SUPABASE_PROJECT_ID at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lumorox-park-mcp",
  title: "LumoroX Park",
  version: "0.1.0",
  instructions:
    "Tools for LumoroX Park — a peer-to-peer parking marketplace. Use `search_spaces` to find nearby parking, `create_booking` to reserve a space, `list_my_bookings` / `list_my_spaces` to review the signed-in user's activity, `raise_dispute` to open a dispute on a booking, and `list_notifications` to read alerts.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchSpaces,
    createBooking,
    listMyBookings,
    listMySpaces,
    raiseDispute,
    listNotifications,
  ],
});
