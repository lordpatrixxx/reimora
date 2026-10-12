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
