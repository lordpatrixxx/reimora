-- Outbox columns
alter table public.notifications drop constraint notifications_status_check;
alter table public.notifications add constraint notifications_status_check check (status in ('queued','processing','sent','failed','permanently_failed'));
alter table public.notifications add column if not exists provider_message_id text,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_retry_at timestamptz;

-- Branch reference table
create table if not exists public.branches (code text primary key, name text not null unique, sort int not null);
alter table public.branches enable row level security;
grant select on public.branches to anon, authenticated;
create policy "branches readable" on public.branches for select using (true);
insert into public.branches(code,name,sort) values
 ('CIVIL','Civil Engineering',1),
 ('CIVIL-RL','Civil Engineering (Regional Language)',2),
 ('COMP','Computer Engineering',3),
 ('COMP-RL','Computer Engineering (Regional Language)',4),
 ('CSE-AIML','Computer Science and Engineering (Artificial Intelligence and Machine Learning)',5),
 ('ENTC','Electronics and Telecommunication Engineering',6),
 ('VLSI','Electronics Engineering (VLSI Design & Technology)',7),
 ('IT','Information Technology',8),
 ('MECH','Mechanical Engineering',9)
on conflict (code) do nothing;

alter table public.students add column if not exists branch_code text references public.branches(code);
update public.students set branch_code = case
  when upper(trim(department)) in ('IT','INFORMATION TECHNOLOGY') then 'IT'
  when upper(trim(department)) in ('E&TC','ENTC','EXTC') then 'ENTC'
  when upper(trim(department)) in ('COMP','CE','COMPUTER','COMPUTER ENGINEERING') then 'COMP'
  when upper(trim(department)) in ('MECH','MECHANICAL','MECHANICAL ENGINEERING') then 'MECH'
  when upper(trim(department)) in ('CIVIL','CIVIL ENGINEERING') then 'CIVIL'
  when upper(trim(department)) in ('AIML','CSE-AIML') then 'CSE-AIML'
  else null end
where branch_code is null;

create or replace function public.sync_student_branch() returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.branch_code is not null then
    select name into new.department from public.branches where code=new.branch_code;
  else
    select code into new.branch_code from public.branches where lower(name)=lower(trim(new.department));
  end if;
  return new;
end $$;
drop trigger if exists students_branch_sync on public.students;
create trigger students_branch_sync before insert or update of branch_code, department on public.students for each row execute function public.sync_student_branch();

-- Welcome email on first registration (once per user via dedupe key)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare nm text;
begin
  nm := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1));
  insert into public.profiles(id, full_name, email, college)
  values (new.id, nm, new.email, public.college_for_email(new.email))
  on conflict (id) do nothing;
  perform public.bootstrap_super_admin(new.id, new.email, new.email_confirmed_at);
  begin
    perform public.notify_user(new.id, 'account', 'welcome', 'Welcome to Reimora — registration successful',
      'Hi ' || nm || ',' || chr(10) ||
      'Your Reimora account was created successfully.' || chr(10) ||
      'Current access status: no access granted yet. Registration does not give access to claims or reviews.' || chr(10) ||
      'Next step: sign in and request Student access (to submit reimbursement claims) or Faculty / Club Approver access (to review claims). The administrator will review your request.',
      'welcome:' || new.id, null, null);
  exception when others then null; -- never block signup because of email
  end;
  return new;
end $function$;

-- Access request: admin email (richer) + applicant acknowledgement
create or replace function public.submit_access_request(_role app_role, _scope uuid, _scope_text text, _details jsonb)
 returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare rid uuid; rref text; nm text; sname text; why text; em text; rolel text; nl text := chr(10);
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if public.is_suspended(auth.uid()) then raise exception 'Your account is suspended'; end if;
  if _role not in ('student','faculty') then raise exception 'This role cannot be requested'; end if;
  if exists(select 1 from public.user_roles where user_id=auth.uid() and role=_role) and (_role='student' or public.in_my_scope(_scope)) then
    raise exception 'You already have this access';
  end if;
  if coalesce(trim(_details->>'full_name'),'')='' or coalesce(trim(_details->>'department'),'')='' then
    raise exception 'Name and department are required';
  end if;
  if _role='student' and (coalesce(trim(_details->>'prn'),'')='' or coalesce(trim(_details->>'year'),'')='') then raise exception 'PRN and year are required for students'; end if;
  if _role='student' and not exists(select 1 from public.branches where code=_details->>'branch_code') then raise exception 'Choose your B.Tech branch'; end if;
  if _role='faculty' and coalesce(trim(_details->>'designation'),'')='' then raise exception 'Designation is required for approvers'; end if;
  if exists(select 1 from public.access_requests where user_id=auth.uid() and requested_role=_role and status='PENDING'
     and coalesce(scope_id::text, lower(coalesce(scope_text,''))) = coalesce(_scope::text, lower(coalesce(_scope_text,'')))) then
    raise exception 'You already have a pending request for this role and scope';
  end if;
  insert into public.access_requests(user_id, requested_role, scope_id, scope_text, details)
  values (auth.uid(), _role, _scope, nullif(trim(_scope_text),''), _details) returning id, ref into rid, rref;
  update public.profiles set full_name = trim(_details->>'full_name') where id=auth.uid();
  select email into em from public.profiles where id=auth.uid();
  nm := trim(_details->>'full_name');
  rolel := case when _role='student' then 'Student' else 'Faculty / Club Approver' end;
  select name into sname from public.scopes where id=_scope;
  why := nullif(left(_details->>'reason', 200), '');
  perform public.notify_admins('access', 'access_request',
    'Reimora: New access request — ' || nm || ' — ' || rolel,
    'Applicant: ' || nm || ' (' || coalesce(em,'') || ', verified sign-in)' || nl ||
    'Requested role: ' || rolel || nl ||
    coalesce('PRN: ' || nullif(_details->>'prn','') || nl, '') ||
    'Branch / department: ' || coalesce(_details->>'department','—') || nl ||
    coalesce('Year / division: ' || nullif(concat_ws(' / ', nullif(_details->>'year',''), nullif(_details->>'division','')),'') || nl, '') ||
    coalesce('Club / activity: ' || coalesce(sname, nullif(_scope_text,''), nullif(_details->>'club','')) || nl, '') ||
    coalesce('Designation: ' || nullif(_details->>'designation','') || nl, '') ||
    coalesce('Reason: ' || why || nl, '') ||
    'Request ID: ' || rref || nl ||
    'Submitted: ' || to_char(now() at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH24:MI') || ' IST' || nl ||
    'Open the request to review it. Opening the link requires administrator sign-in and does not approve anything.',
    'ar:' || rid, null, rid);
  perform public.notify_user(auth.uid(), 'access', 'access_received', 'Reimora: We received your access request ' || rref,
    'Hi ' || nm || ',' || nl || 'Your request for ' || rolel || ' access (' || rref || ') was received and is pending administrator review.' || nl ||
    'You will get another email once it is approved or rejected. No access is granted until then.',
    'ar-ack:' || rid, null, rid);
  return rid;
end $function$;

-- Copy branch on approval
create or replace function public.decide_access_request(_id uuid, _approve boolean, _reason text, _scope uuid)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare r record; p record; st record; d jsonb; sname text; bc text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only administrators can decide access requests'; end if;
  select * into r from public.access_requests where id=_id for update;
  if r is null then raise exception 'Request not found'; end if;
  if r.status <> 'PENDING' then raise exception 'This request was already %', lower(r.status); end if;
  if r.user_id = auth.uid() then raise exception 'You cannot decide your own request'; end if;
  d := r.details;
  select code into bc from public.branches where code = d->>'branch_code';
  select * into p from public.profiles where id=r.user_id;
  if _approve then
    insert into public.user_roles(user_id, role) values (r.user_id, r.requested_role) on conflict do nothing;
    if r.requested_role='faculty' then
      if _scope is null then raise exception 'Choose the scope this approver may review'; end if;
      insert into public.approver_scopes(user_id, scope_id, granted_by) values (r.user_id, _scope, auth.uid()) on conflict do nothing;
    end if;
    if r.requested_role='student' and not exists(select 1 from public.students where user_id=r.user_id) then
      select * into st from public.students where upper(prn)=upper(trim(d->>'prn'));
      if st is not null then
        if st.user_id is null and lower(st.email)=lower(p.email) then update public.students set user_id=r.user_id, branch_code=coalesce(bc, branch_code) where id=st.id;
        else raise exception 'PRN % is already registered to another account', d->>'prn'; end if;
      else
        insert into public.students(user_id, full_name, prn, department, branch_code, year, division, email, created_by)
        values (r.user_id, coalesce(trim(d->>'full_name'), p.full_name), upper(trim(d->>'prn')), coalesce(nullif(trim(d->>'department'),''),'Information Technology'), bc,
          nullif(trim(d->>'year'),''), nullif(trim(d->>'division'),''), p.email, auth.uid());
      end if;
    end if;
    update public.access_requests set status='APPROVED', reviewer=auth.uid(), reviewer_name=public.actor_name(), decided_at=now(),
      decision_reason=nullif(trim(_reason),''), granted_scope_id=_scope where id=_id;
    select name into sname from public.scopes where id=_scope;
    perform public.audit('Access approved', r.user_id, _id, jsonb_build_object('role', r.requested_role, 'scope', sname));
    perform public.notify_user(r.user_id, 'access', 'access_approved', 'Reimora: Your access request ' || r.ref || ' was approved',
      'Your request ' || r.ref || ' was approved.' || chr(10) || 'Access granted: ' || case when r.requested_role='student' then 'Student' else 'Faculty / Club Approver' end
        || coalesce(' for ' || sname, '') || '.' || chr(10) || 'Sign in to open your dashboard.', 'ar-dec:' || _id, null, _id);
  else
    if coalesce(trim(_reason),'')='' then raise exception 'A reason is required to reject'; end if;
    update public.access_requests set status='REJECTED', reviewer=auth.uid(), reviewer_name=public.actor_name(), decided_at=now(), decision_reason=trim(_reason) where id=_id;
    perform public.audit('Access rejected', r.user_id, _id, jsonb_build_object('role', r.requested_role, 'reason', _reason));
    perform public.notify_user(r.user_id, 'access', 'access_rejected', 'Reimora: Your access request ' || r.ref || ' was not approved',
      'Your request ' || r.ref || ' was not approved.' || chr(10) || 'Reason: ' || trim(_reason) || chr(10) || 'You can correct the details and submit a new request from Reimora.', 'ar-dec:' || _id, null, _id);
  end if;
end $function$;

-- Claim submission with detailed summary email, once per revision
create or replace function public.submit_claim(_claim uuid) returns void language plpgsql security definer set search_path to 'public' as $function$
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
    lines := lines || '  • ' || coalesce(e.vendor,'Vendor not given') || ' — ' || coalesce(e.category,'—') || ' — ' || public.fmt_inr(e.amount_paise) || nl;
  end loop;
  begin
    select string_agg(ad.ref || ' (' || public.fmt_inr(al.amount_paise) || ')', ', ') into adv
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