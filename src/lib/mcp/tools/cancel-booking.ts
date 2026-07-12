import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function clientFor(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "cancel_booking",
  title: "Cancel a booking",
  description:
    "Cancel a booking as its renter or host. Only bookings that are pending or confirmed (and not yet checked in) can be cancelled.",
  inputSchema: {
    booking_id: z.string().uuid().describe("Booking id to cancel"),
    reason: z.string().trim().max(500).optional().describe("Optional cancellation reason"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ booking_id, reason }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = clientFor(ctx);
    const { data, error } = await supabase.rpc("cancel_booking", {
      p_booking_id: booking_id,
      p_reason: reason ?? null,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Booking ${booking_id} cancelled.` }],
      structuredContent: { booking: data },
    };
  },
});
