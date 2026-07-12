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
  name: "raise_dispute",
  title: "Raise a booking dispute",
  description: "Open a dispute on one of the signed-in user's bookings, with a written reason.",
  inputSchema: {
    booking_id: z.string().uuid(),
    reason: z.string().min(4).describe("Short description of what went wrong"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ booking_id, reason }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await clientFor(ctx).rpc("raise_dispute", {
      p_booking_id: booking_id,
      p_reason: reason,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Dispute opened: ${JSON.stringify(data)}` }],
      structuredContent: { dispute_id: data },
    };
  },
});
