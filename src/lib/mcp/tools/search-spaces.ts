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
  name: "search_spaces",
  title: "Search parking spaces",
  description:
    "Search active parking listings near a lat/lng location, optionally within a time window and price/feature filters.",
  inputSchema: {
    lat: z.number().describe("Latitude"),
    lng: z.number().describe("Longitude"),
    radius_km: z.number().default(5).describe("Search radius in kilometers"),
    starts: z.string().optional().describe("ISO start time"),
    ends: z.string().optional().describe("ISO end time"),
    covered: z.boolean().optional(),
    gated: z.boolean().optional(),
    ev_charging: z.boolean().optional(),
    max_price_per_hour: z.number().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (input, ctx) => {
    const { data, error } = await clientFor(ctx).rpc("search_spaces", {
      p_lat: input.lat,
      p_lng: input.lng,
      p_radius_km: input.radius_km,
      p_starts: input.starts ?? null,
      p_ends: input.ends ?? null,
      p_covered: input.covered ?? null,
      p_gated: input.gated ?? null,
      p_ev: input.ev_charging ?? null,
      p_max_price: input.max_price_per_hour ?? null,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { results: data ?? [] },
    };
  },
});
