// Server-only email outbox worker: renders branded HTML and sends queued notifications through the linked Gmail connection.
import type { SupabaseClient } from "@supabase/supabase-js";

export const APP_URL = "https://reimora.lovable.app";
const MAX_ATTEMPTS = 5;

type Row = {
  id: string; kind: string; category: string; subject: string; body: string; recipient_email: string;
  claim_id: string | null; access_request_id: string | null; attempts: number;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function linkFor(n: Pick<Row, "kind" | "claim_id" | "access_request_id">): { href: string; label: string } {
  if (n.claim_id) return { href: `${APP_URL}/claims/${n.claim_id}`, label: n.kind === "claim_to_review" ? "Review claim" : "Open claim" };
  if (n.kind === "access_request" && n.access_request_id) return { href: `${APP_URL}/admin/requests?id=${n.access_request_id}`, label: "Open request (admin sign-in)" };
  return { href: `${APP_URL}/dashboard`, label: "Open Reimora" };
}

/** Professional Reimora email. "Label: value" lines become a detail table; "  • " lines become a list. */
export function emailHtml(n: Pick<Row, "subject" | "body" | "kind" | "claim_id" | "access_request_id">): string {
  const title = n.subject.replace(/^Reimora:\s*/, "");
  const lines = n.body.split(/\n/).map((l) => l.trimEnd()).filter(Boolean);
  let html = "", rows = "", items = "";
  const flushRows = () => { if (rows) { html += `<table role="presentation" width="100%" style="border-collapse:collapse;margin:4px 0 16px;font-size:14px">${rows}</table>`; rows = ""; } };
  const flushItems = () => { if (items) { html += `<ul style="margin:0 0 16px;padding-left:18px;font-size:14px;line-height:1.7;color:#2b3a34">${items}</ul>`; items = ""; } };
  for (const l of lines) {
    const bullet = /^\s*•\s*(.+)$/.exec(l);
    const kv = /^([A-Z][^:]{1,40}):\s(.+)$/.exec(l);
    if (bullet) { flushRows(); items += `<li>${esc(bullet[1])}</li>`; continue; }
    flushItems();
    if (kv && !/^Hi /.test(l)) {
      rows += `<tr><td style="padding:7px 12px 7px 0;color:#6b766f;white-space:nowrap;vertical-align:top;border-bottom:1px solid #eef0ea">${esc(kv[1])}</td><td style="padding:7px 0;color:#14231d;font-weight:600;border-bottom:1px solid #eef0ea">${esc(kv[2])}</td></tr>`;
    } else if (/:$/.test(l)) {
      flushRows(); html += `<p style="margin:8px 0 4px;font-size:13px;font-weight:700;color:#143D32;text-transform:uppercase;letter-spacing:.04em">${esc(l.slice(0, -1))}</p>`;
    } else {
      flushRows(); html += `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#2b3a34">${esc(l)}</p>`;
    }
  }
  flushRows(); flushItems();
  const link = linkFor(n);
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:28px 16px">
  <div style="background:#143D32;border-radius:14px 14px 0 0;padding:18px 24px">
    <span style="display:inline-block;background:#D8F36A;color:#143D32;font-weight:800;border-radius:8px;padding:3px 10px;font-size:15px">R</span>
    <span style="color:#F7F8F4;font-size:17px;font-weight:700;margin-left:8px;vertical-align:middle">Reimora</span>
  </div>
  <div style="background:#ffffff;border:1px solid #e3e6de;border-top:0;border-radius:0 0 14px 14px;padding:26px 24px">
    <h1 style="margin:0 0 18px;font-size:20px;line-height:1.3;color:#143D32">${esc(title)}</h1>
    ${html}
    <p style="margin:22px 0 4px"><a href="${esc(link.href)}" style="display:inline-block;background:#143D32;color:#F7F8F4;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;padding:11px 18px">${esc(link.label)}</a></p>
    <p style="margin:6px 0 0;font-size:12px;color:#8a938c">Signing in is required. Links never approve anything on their own.</p>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a938c;border-top:1px solid #eef0ea;padding-top:12px">
      Reimora · Student reimbursement &amp; advance settlement · A student project, not an official college service.<br/>You received this because of activity on your Reimora account.
    </p>
  </div>
</div></body></html>`;
}

const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const b64url = (s: string) => b64(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const mimeHeader = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

export function emailConfigured() {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["GOOGLE_MAIL_API_KEY"]);
}

/** Sends via Gmail; returns Gmail's message id (proof of acceptance, not of inbox delivery). */
export async function sendGmail(to: string, subject: string, html: string, refId: string): Promise<string> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableKey || !gmailKey) throw new Error("Gmail connection is not linked to this project");
  const raw = [
    `To: ${to}`,
    `From: ${mimeHeader("Reimora")} <me>`,
    `Subject: ${mimeHeader(subject)}`,
    `X-Reimora-Notification: ${refId}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(html).replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n").replace("From: Reimora <me>\r\n", "");
  const res = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmailKey, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64url(raw) }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gmail refused the message (${res.status}): ${t.replace(/\s+/g, " ").slice(0, 200)}`);
  }
  const j = (await res.json().catch(() => ({}))) as { id?: string };
  return j.id ?? "";
}

/**
 * Claims each due row atomically (queued/failed -> processing) so concurrent workers never double-send,
 * then records accepted/failed with bounded exponential backoff.
 */
export async function deliverDue(admin: SupabaseClient, limit = 25) {
  const now = new Date();
  // Rows stuck in "processing" (worker died mid-send) have an unknown outcome: surface them for a manual check instead of blind resend.
  await admin.from("notifications").update({ status: "failed", next_retry_at: null, last_error: "Outcome unknown (send was interrupted). Check the Gmail Sent folder before retrying." })
    .eq("status", "processing").lt("last_attempt_at", new Date(now.getTime() - 10 * 60_000).toISOString());

  const { data: due } = await admin.from("notifications").select("id, attempts")
    .in("status", ["queued", "failed"]).lt("attempts", MAX_ATTEMPTS)
    .or(`next_retry_at.is.null,next_retry_at.lte.${now.toISOString()}`)
    .order("created_at").limit(limit);
  let sent = 0, failed = 0;
  const configured = emailConfigured();
  for (const d of due ?? []) {
    const { data: claimed } = await admin.from("notifications")
      .update({ status: "processing", attempts: d.attempts + 1, last_attempt_at: new Date().toISOString() })
      .eq("id", d.id).eq("attempts", d.attempts).in("status", ["queued", "failed"]).select("*").maybeSingle();
    if (!claimed) continue;
    const n = claimed as Row;
    const attempts = n.attempts;
    try {
      if (!configured) throw new Error("Gmail connection is not linked to this project");
      const msgId = await sendGmail(n.recipient_email, n.subject, emailHtml(n), n.id);
      await admin.from("notifications").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null, next_retry_at: null, provider_message_id: msgId || null }).eq("id", n.id);
      sent++;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : "Send failed").slice(0, 300);
      const permanent = attempts >= MAX_ATTEMPTS || /\(400\)|invalid to header|Invalid To/i.test(msg);
      await admin.from("notifications").update({
        status: permanent ? "permanently_failed" : "failed",
        last_error: msg,
        next_retry_at: permanent ? null : new Date(Date.now() + 2 ** attempts * 60_000).toISOString(),
      }).eq("id", n.id);
      failed++;
    }
  }
  return { processed: due?.length ?? 0, sent, failed, configured };
}
