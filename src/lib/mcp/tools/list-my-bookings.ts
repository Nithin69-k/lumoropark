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
  name: "list_my_bookings",
  title: "List my bookings",
  description:
    "List the signed-in user's parking bookings (both as renter and host), most recent first.",
  inputSchema: {
    role: z
      .enum(["renter", "host", "any"])
      .default("any")
      .describe("Filter by role. 'renter' = bookings you made, 'host' = bookings on your spaces."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ role, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = clientFor(ctx);
    let q = supabase
      .from("bookings")
      .select(
        "id, status, payment_status, start_time, end_time, total_price, renter_id, host_id, space:parking_spaces(id, title, address)",
      )
      .order("start_time", { ascending: false })
      .limit(limit);
    const uid = ctx.getUserId();
    if (role === "renter") q = q.eq("renter_id", uid);
    else if (role === "host") q = q.eq("host_id", uid);
    else q = q.or(`renter_id.eq.${uid},host_id.eq.${uid}`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { bookings: data ?? [] },
    };
  },
});
