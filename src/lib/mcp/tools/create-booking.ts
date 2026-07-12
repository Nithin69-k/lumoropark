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
  name: "create_booking",
  title: "Create a pending parking booking",
  description:
    "Create a pending booking for the signed-in user for a given parking space and time window. Payment is completed separately in the app.",
  inputSchema: {
    space_id: z.string().uuid().describe("Parking space id"),
    start_time: z.string().describe("ISO start timestamp with timezone"),
    end_time: z.string().describe("ISO end timestamp with timezone"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ space_id, start_time, end_time }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await clientFor(ctx).rpc("create_pending_booking", {
      p_space_id: space_id,
      p_start: start_time,
      p_end: end_time,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Booking created: ${JSON.stringify(data)}` }],
      structuredContent: { booking_id: data },
    };
  },
});
