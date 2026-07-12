import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function clientFor(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

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
    const userId = ctx.getUserId();

    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, renter_id, host_id, status, checked_in_at, start_time")
      .eq("id", booking_id)
      .maybeSingle();

    if (fetchError)
      return { content: [{ type: "text", text: fetchError.message }], isError: true };
    if (!booking)
      return {
        content: [{ type: "text", text: "Booking not found or you do not have access to it." }],
        isError: true,
      };

    const isRenter = booking.renter_id === userId;
    const isHost = booking.host_id === userId;
    if (!isRenter && !isHost)
      return {
        content: [{ type: "text", text: "Only the renter or host of this booking can cancel it." }],
        isError: true,
      };

    if (booking.status === "cancelled")
      return {
        content: [{ type: "text", text: "This booking is already cancelled." }],
        isError: true,
      };
    if (!CANCELLABLE_STATUSES.has(booking.status))
      return {
        content: [
          {
            type: "text",
            text: `Booking cannot be cancelled from status "${booking.status}". Only pending or confirmed bookings can be cancelled.`,
          },
        ],
        isError: true,
      };
    if (booking.checked_in_at)
      return {
        content: [{ type: "text", text: "Booking has already been checked in and cannot be cancelled." }],
        isError: true,
      };

    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking_id)
      .select("id, status, renter_id, host_id, start_time, end_time")
      .maybeSingle();

    if (updateError)
      return { content: [{ type: "text", text: updateError.message }], isError: true };

    const role = isRenter ? "renter" : "host";
    await supabase.from("activity_log").insert({
      user_id: userId,
      action: "booking_cancelled",
      entity_type: "booking",
      entity_id: booking_id,
      metadata: { role, reason: reason ?? null },
    });

    return {
      content: [
        {
          type: "text",
          text: `Booking ${booking_id} cancelled by ${role}.`,
        },
      ],
      structuredContent: { booking: updated, cancelled_by: role },
    };
  },
});
