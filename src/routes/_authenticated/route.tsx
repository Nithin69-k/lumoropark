import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (data?.user) return { user: data.user };

    // A transient network/5xx blip on getUser() must not sign the visitor out.
    // Fall back to the locally persisted session before bouncing to /auth.
    if (error) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) return { user: sessionData.session.user };
    }

    throw redirect({
      to: "/auth",
      search: { mode: "signin", next: location.href },
    });
  },

  component: () => <Outlet />,
});
