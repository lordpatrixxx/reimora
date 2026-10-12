CREATE OR REPLACE FUNCTION public.submit_claim(_claim uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c record; total bigint; bad int; b record; sc record; a record; napprovers int := 0; s record; rev int; lines text := ''; e record;
  adv text; reviewers text; nl text := chr(10); label text;
begin
  select * into c from public.claims where id=_claim for update;
  if c is null or not public.can_edit_claim(_claim) then raise exception 'You cannot submit this claim'; end if;
  if c.scope_id is null then raise exception 'Choose the department, club or activity for this claim'; end if;
  select * into sc from public.scopes where id=c.scope_id and active;
  if sc is null then raise exception 'The selected department, club or activity is no longer active'; end if;
  select count(*) into bad from public.expenses where claim_id=_claim and (confirmed_at is null or amount_paise is null or category is null);
  if bad > 0 then raise exception 'Every expense needs confirmed details, an amount and a category'; end if;
  select coalesce(sum(amount_paise),0) into total from public.expenses where claim_id=_claim;
  if total <= 0 then raise exception 'Add at least one expense'; end if;
  if c.beneficiary_id is null or not c.beneficiary_confirmed then raise exception 'Select and confirm the beneficiary'; end if;
  select * into b from public.beneficiaries where id=c.beneficiary_id and student_id=c.student_id and is_active;
  if b is null then raise exception 'Beneficiary does not belong to this student'; end if;
  perform set_config('app.trusted','on',true);
  update public.claims set status='submitted', claimed_paise=total, submitted_at=now(),
    beneficiary_snapshot=jsonb_build_object('holder_name',b.holder_name,'bank_name',b.bank_name,'account_last4',b.account_last4,'ifsc',b.ifsc,'is_fictional',b.is_fictional)
  where id=_claim;
  insert into public.claim_events(claim_id, actor, actor_name, from_status, to_status, action)
  values (_claim, auth.uid(), public.actor_name(), c.status, 'submitted', case when c.status='changes_requested' then 'Resubmitted' else 'Submitted' end);
  perform public.detect_duplicates(_claim);
  select count(*) into rev from public.claim_events where claim_id=_claim and to_status='submitted';
  reviewers := null;
  for a in select s2.user_id, p.full_name from public.approver_scopes s2 join public.user_roles r on r.user_id=s2.user_id and r.role='faculty'
           left join public.profiles p on p.id=s2.user_id
           where s2.scope_id=c.scope_id and not public.is_suspended(s2.user_id) and s2.user_id <> auth.uid() loop
    napprovers := napprovers + 1;
    reviewers := concat_ws(', ', reviewers, a.full_name);
    perform public.notify_user(a.user_id, 'claim', 'claim_to_review', 'Reimora: ' || c.ref || ' needs your review',
      'A claim "' || c.title || '" for ' || public.fmt_inr(total) || ' was submitted under ' || sc.name || '.' || nl || 'Open it in Reimora to review the evidence and decide.',
      _claim || ':review:' || a.user_id || ':' || rev, _claim, null);
  end loop;
  perform public.notify_admins('claim', case when napprovers=0 then 'claim_unassigned' else 'claim_new' end,
    'Reimora: ' || c.ref || case when napprovers=0 then ' submitted — no approver assigned' else ' submitted' end,
    'Claim "' || c.title || '" for ' || public.fmt_inr(total) || ' was submitted under ' || sc.name || '.'
      || case when napprovers=0 then nl || 'No approver covers this scope yet. It is in Unassigned claims; assign an approver in Admin.' else '' end,
    _claim || ':admin:' || rev, _claim, null);

  select st.* into s from public.students st where st.id=c.student_id;
  for e in select vendor, category, amount_paise from public.expenses where claim_id=_claim order by created_at loop
    lines := lines || '  • ' || coalesce(e.vendor,'Vendor not given') || ' — ' || coalesce(e.category::text,'—') || ' — ' || public.fmt_inr(e.amount_paise) || nl;
  end loop;
  begin
    select string_agg(coalesce(ad.reference, ad.purpose, 'Advance') || ' (' || public.fmt_inr(al.amount_paise) || ')', ', ') into adv
    from public.advance_allocations al join public.advances ad on ad.id=al.advance_id where al.claim_id=_claim;
  exception when others then adv := null;
  end;
  label := case when rev > 1 then ' resubmitted (revision ' || rev || ')' else ' submitted successfully' end;
  perform public.enqueue_notice(_claim, 'submitted', 'Reimora: Claim ' || c.ref || label,
    'Student: ' || coalesce(s.full_name,'—') || coalesce(' (PRN ' || s.prn || ')', '') || nl ||
    'Branch / division: ' || coalesce(s.department,'—') || coalesce(' / ' || s.division, '') || nl ||
    'Claim: ' || c.ref || ' — ' || c.title || nl ||
    coalesce('Purpose: ' || nullif(c.purpose,'') || nl, '') ||
    'Department / club / activity: ' || sc.name || nl ||
    'Submitted: ' || to_char(now() at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH24:MI') || ' IST' || nl ||
    'Expenses:' || nl || lines ||
    'Total claimed: ' || public.fmt_inr(total) || ' (claimed, not yet approved or paid)' || nl ||
    coalesce('Linked advance: ' || adv || nl, '') ||
    'Status: Submitted — awaiting review' || nl ||
    'Reviewer: ' || coalesce(reviewers, 'Reviewer assignment pending; the administrator has been notified.'),
    _claim || ':submitted:' || rev);
end $function$;