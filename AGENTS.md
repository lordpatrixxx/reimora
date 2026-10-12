<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Reimora architecture
- Money is integer paise everywhere; authoritative totals and state transitions live in Postgres security-definer functions (submit_claim, decide_claim, allocate_advance, record_payment) — prevents client tampering and double-settlement races.
- Protected claim columns are guarded by triggers; only workflow functions (app.trusted) may change status/amounts — stops silent edits after submission.
- Evidence files live in the private `evidence` bucket at `{claim_id}/{expense_id}/file`; server fn `registerAttachment` validates content and is the only way attachment rows are created.
- AI extraction stores the first result immutably in `expenses.extraction`; re-scans go to `extraction_rescan` and never overwrite confirmed data.
- The public /demo page uses static fictional data only — keeps demo isolated from live records and email.
- Theme: light/dark via `.dark` class on <html>, set pre-paint by inline script in __root and persisted in localStorage — avoids wrong-theme flash.
- Access model: sign-in grants nothing; roles come only from admin-approved `access_requests` via security-definer RPCs (decide_access_request, set_user_role, admin_*), all audited in `admin_audit` — prevents self-promotion.
- `has_role` returns false for suspended users and true for super_admin — so suspension instantly blocks every policy/RPC and the admin passes all role checks; self-review is blocked separately by `is_own_claim`.
- Claims route by `claims.scope_id` → `approver_scopes`; approvers see only their scope or claims assigned to them — students never pick a reviewer.
- Users without roles see the AccessGate in AppShell instead of any route — avoids flashes of privileged UI.
- Emails: DB functions queue rows in `notifications` (outbox, unique dedupe_key); `src/lib/email-outbox.server.ts` claims rows atomically and sends via the Gmail connector. It runs right after each action (`kickEmails`) and from a 10-minute scheduled job — so emails never depend on an admin clicking "send".
- Student branches come from the `branches` reference table (stable codes); `students.branch_code` syncs `department` via trigger.
