import { kickEmailDelivery } from "@/lib/evidence.functions";

/** Fire-and-forget: ask the server to send emails the database just queued. Never blocks or fails the user's action. */
export function kickEmails() {
  kickEmailDelivery().catch(() => {});
}
