import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Scheduled backstop: retries due/failed emails even when nobody has the app open.
export const Route = createFileRoute("/api/public/jobs/deliver-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { deliverDue } = await import("@/lib/email-outbox.server");
        const r = await deliverDue(supabaseAdmin, 25);
        return Response.json({ success: true, ...r });
      },
    },
  },
});
