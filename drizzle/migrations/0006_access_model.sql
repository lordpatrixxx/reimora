
-- ===== New tables =====
CREATE TABLE public.account_status (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  suspended boolean NOT NULL DEFAULT false,
  reason text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_status TO authenticated;
GRANT ALL ON public.account_status TO service_role;
ALTER TABLE public.account_status ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('department','club','activity')),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, name)
);
GRANT SELECT ON public.scopes TO authenticated;
GRANT ALL ON public.scopes TO service_role;
ALTER TABLE public.scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scopes read" ON public.scopes FOR SELECT TO authenticated USING (true);

CREATE TABLE public.approver_scopes (
  user_id uuid NOT NULL,
  scope_id uuid NOT NULL REFERENCES public.scopes(id) ON DELETE CASCADE,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope_id)
);
GRANT SELECT ON public.approver_scopes TO authenticated;
GRANT ALL ON public.approver_scopes TO service_role;
ALTER TABLE public.approver_scopes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL DEFAULT ('AR-' || upper(substr(md5(random()::text), 1, 6))),
  user_id uuid NOT NULL,
  requested_role public.app_role NOT NULL,
  scope_id uuid REFERENCES public.scopes(id),
  scope_text text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewer uuid,
  reviewer_name text,
  decided_at timestamptz,
  decision_reason text,
  granted_scope_id uuid REFERENCES public.scopes(id)
);
CREATE UNIQUE INDEX access_requests_one_pending ON public.access_requests (user_id, requested_role, coalesce(scope_id::text, lower(coalesce(scope_text,'')))) WHERE status = 'PENDING';
GRANT SELECT ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid,
  actor_name text,
  action text NOT NULL,
  target_user uuid,
  target_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit TO authenticated;
GRANT ALL ON public.admin_audit TO service_role;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.claims ADD COLUMN scope_id uuid REFERENCES public.scopes(id);
ALTER TABLE public.notifications ADD COLUMN category text NOT NULL DEFAULT 'claim';
ALTER TABLE public.notifications ADD COLUMN access_request_id uuid REFERENCES public.access_requests(id);
COMMENT ON COLUMN public.profiles.requested_role IS 'DEPRECATED: replaced by public.access_requests';

-- ===== Core helpers =====
CREATE OR REPLACE FUNCTION public.is_suspended(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.account_status where user_id=_uid and suspended)
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select not public.is_suspended(_user_id) and exists (select 1 from public.user_roles where user_id = _user_id and (role = _role or role = 'super_admin'))
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select not public.is_suspended(_uid) and exists (select 1 from public.user_roles where user_id=_uid and role='super_admin')
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select not public.is_suspended(_uid) and exists (select 1 from public.user_roles where user_id = _uid and role in ('faculty','finance','super_admin'))
$$;

CREATE OR REPLACE FUNCTION public.my_student_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select id from public.students where user_id = auth.uid() and not public.is_suspended(auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.in_my_scope(_scope uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select _scope is not null and exists(select 1 from public.approver_scopes where user_id=auth.uid() and scope_id=_scope)
$$;

CREATE OR REPLACE FUNCTION public.can_view_claim(_claim uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select not public.is_suspended(auth.uid()) and exists(select 1 from public.claims c where c.id=_claim and (
    c.student_id = public.my_student_id() or c.created_by = auth.uid()
    or public.has_role(auth.uid(),'finance')
    or (public.has_role(auth.uid(),'faculty') and c.status <> 'draft' and (c.assigned_faculty = auth.uid() or (c.assigned_faculty is null and public.in_my_scope(c.scope_id))))
  ))
$$;

CREATE OR REPLACE FUNCTION public.can_edit_claim(_claim uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select not public.is_suspended(auth.uid()) and exists(select 1 from public.claims c where c.id=_claim and c.status in ('draft','changes_requested') and (
    c.student_id = public.my_student_id() or c.created_by = auth.uid() or public.has_role(auth.uid(),'finance')))
$$;

CREATE OR REPLACE FUNCTION public.is_own_claim(_claim uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.claims c join public.students s on s.id=c.student_id where c.id=_claim and (s.user_id = auth.uid() or c.created_by = auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.can_review_claim(_claim uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select not public.is_own_claim(_claim) and (public.is_admin(auth.uid()) or (public.has_role(auth.uid(),'faculty') and exists(
    select 1 from public.claims c where c.id=_claim and (c.assigned_faculty = auth.uid() or (c.assigned_faculty is null and public.in_my_scope(c.scope_id))))))
$$;

CREATE OR REPLACE FUNCTION public.audit(_action text, _target_user uuid, _target uuid, _details jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  insert into public.admin_audit(actor, actor_name, action, target_user, target_id, details) values (auth.uid(), public.actor_name(), _action, _target_user, _target, _details)
$$;

CREATE OR REPLACE FUNCTION public.notify_user(_user uuid, _category text, _kind text, _subject text, _body text, _dedupe text, _claim uuid, _request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare em text;
begin
  select email into em from public.profiles where id=_user;
  if em is null then return; end if;
  insert into public.notifications(claim_id, access_request_id, recipient_user, recipient_email, category, kind, subject, body, dedupe_key)
  values (_claim, _request, _user, em, _category, _kind, _subject, _body, _dedupe) on conflict (dedupe_key) do nothing;
end $$;

CREATE OR REPLACE FUNCTION public.notify_admins(_category text, _kind text, _subject text, _body text, _dedupe text, _claim uuid, _request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a record;
begin
  for a in select distinct r.user_id from public.user_roles r where r.role='super_admin' and not public.is_suspended(r.user_id) loop
    perform public.notify_user(a.user_id, _category, _kind, _subject, _body, _dedupe || ':' || a.user_id, _claim, _request);
  end loop;
end $$;

-- ===== RLS for new tables =====
CREATE POLICY "status read" ON public.account_status FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "approver scopes read" ON public.approver_scopes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "requests read" ON public.access_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "audit read" ON public.admin_audit FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "student self-link" ON public.students;
CREATE POLICY "student self-link" ON public.students FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(),'student'));

-- ===== Signup: identity only, no automatic privileges =====
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  insert into public.profiles(id, full_name, email, college)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, public.college_for_email(new.email))
  on conflict (id) do nothing;
  perform public.bootstrap_super_admin(new.id, new.email, new.email_confirmed_at);
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(_id uuid, _email text, _confirmed timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if _confirmed is not null and lower(_email) = 'pratik.phapale25@pccoepune.org' then
    insert into public.user_roles(user_id, role) values (_id, 'super_admin') on conflict do nothing;
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.handle_user_confirmed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform public.bootstrap_super_admin(new.id, new.email, new.email_confirmed_at);
  end if;
  return new;
end $$;
CREATE TRIGGER on_auth_user_confirmed AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_user_confirmed();

INSERT INTO public.user_roles(user_id, role)
SELECT id, 'super_admin' FROM auth.users WHERE lower(email)='pratik.phapale25@pccoepune.org' AND email_confirmed_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- ===== Access requests =====
CREATE OR REPLACE FUNCTION public.submit_access_request(_role app_role, _scope uuid, _scope_text text, _details jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare rid uuid; rref text; nm text; sname text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if public.is_suspended(auth.uid()) then raise exception 'Your account is suspended'; end if;
  if _role not in ('student','faculty') then raise exception 'This role cannot be requested'; end if;
  if exists(select 1 from public.user_roles where user_id=auth.uid() and role=_role) and (_role='student' or public.in_my_scope(_scope)) then
    raise exception 'You already have this access';
  end if;
  if coalesce(trim(_details->>'full_name'),'')='' or coalesce(trim(_details->>'reason'),'')='' or coalesce(trim(_details->>'department'),'')='' then
    raise exception 'Name, department and reason are required';
  end if;
  if _role='student' and (coalesce(trim(_details->>'prn'),'')='' or coalesce(trim(_details->>'year'),'')='') then raise exception 'PRN and year are required for students'; end if;
  if _role='faculty' and coalesce(trim(_details->>'designation'),'')='' then raise exception 'Designation is required for approvers'; end if;
  if exists(select 1 from public.access_requests where user_id=auth.uid() and requested_role=_role and status='PENDING'
     and coalesce(scope_id::text, lower(coalesce(scope_text,''))) = coalesce(_scope::text, lower(coalesce(_scope_text,'')))) then
    raise exception 'You already have a pending request for this role and scope';
  end if;
  insert into public.access_requests(user_id, requested_role, scope_id, scope_text, details)
  values (auth.uid(), _role, _scope, nullif(trim(_scope_text),''), _details) returning id, ref into rid, rref;
  update public.profiles set full_name = trim(_details->>'full_name') where id=auth.uid();
  nm := trim(_details->>'full_name');
  select name into sname from public.scopes where id=_scope;
  perform public.notify_admins('access', 'access_request',
    'New access request ' || rref || ': ' || nm,
    nm || ' requested ' || case when _role='student' then 'Student' else 'Faculty / Club Approver' end || ' access'
      || ' for ' || coalesce(sname, _scope_text, _details->>'department') || '. Reason: ' || left(_details->>'reason', 200)
      || '. Request ' || rref || '. Review it at /admin/requests?id=' || rid || ' (sign-in required).',
    'ar:' || rid, null, rid);
  return rid;
end $$;

CREATE OR REPLACE FUNCTION public.withdraw_access_request(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  update public.access_requests set status='WITHDRAWN', decided_at=now() where id=_id and user_id=auth.uid() and status='PENDING';
  if not found then raise exception 'This request is no longer pending'; end if;
end $$;

CREATE OR REPLACE FUNCTION public.decide_access_request(_id uuid, _approve boolean, _reason text, _scope uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare r record; p record; st record; d jsonb; sname text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only administrators can decide access requests'; end if;
  select * into r from public.access_requests where id=_id for update;
  if r is null then raise exception 'Request not found'; end if;
  if r.status <> 'PENDING' then raise exception 'This request was already %', lower(r.status); end if;
  if r.user_id = auth.uid() then raise exception 'You cannot decide your own request'; end if;
  d := r.details;
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
        if st.user_id is null and lower(st.email)=lower(p.email) then update public.students set user_id=r.user_id where id=st.id;
        else raise exception 'PRN % is already registered to another account', d->>'prn'; end if;
      else
        insert into public.students(user_id, full_name, prn, department, year, division, email, created_by)
        values (r.user_id, coalesce(trim(d->>'full_name'), p.full_name), upper(trim(d->>'prn')), coalesce(nullif(trim(d->>'department'),''),'Information Technology'),
          nullif(trim(d->>'year'),''), nullif(trim(d->>'division'),''), p.email, auth.uid());
      end if;
    end if;
    update public.access_requests set status='APPROVED', reviewer=auth.uid(), reviewer_name=public.actor_name(), decided_at=now(),
      decision_reason=nullif(trim(_reason),''), granted_scope_id=_scope where id=_id;
    select name into sname from public.scopes where id=_scope;
    perform public.audit('Access approved', r.user_id, _id, jsonb_build_object('role', r.requested_role, 'scope', sname));
    perform public.notify_user(r.user_id, 'access', 'access_approved', 'Your Reimora access was approved',
      'Your request ' || r.ref || ' for ' || case when r.requested_role='student' then 'Student' else 'Faculty / Club Approver' end || ' access was approved'
        || coalesce(' for ' || sname, '') || '. Sign in to open your dashboard.', 'ar-dec:' || _id, null, _id);
  else
    if coalesce(trim(_reason),'')='' then raise exception 'A reason is required to reject'; end if;
    update public.access_requests set status='REJECTED', reviewer=auth.uid(), reviewer_name=public.actor_name(), decided_at=now(), decision_reason=trim(_reason) where id=_id;
    perform public.audit('Access rejected', r.user_id, _id, jsonb_build_object('role', r.requested_role, 'reason', _reason));
    perform public.notify_user(r.user_id, 'access', 'access_rejected', 'Your Reimora access request was not approved',
      'Your request ' || r.ref || ' was not approved. Reason: ' || trim(_reason) || '. You can submit a new request from Reimora.', 'ar-dec:' || _id, null, _id);
  end if;
end $$;

-- ===== Admin user management =====
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role app_role, _grant boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only administrators can change roles'; end if;
  if _user_id = auth.uid() then raise exception 'You cannot change your own roles'; end if;
  if _grant then
    insert into public.user_roles(user_id, role) values (_user_id,_role) on conflict do nothing;
  else
    if _role='super_admin' and (select count(*) from public.user_roles r where r.role='super_admin' and r.user_id<>_user_id and not public.is_suspended(r.user_id)) = 0 then
      raise exception 'At least one active super administrator must remain';
    end if;
    delete from public.user_roles where user_id=_user_id and role=_role;
    if _role='faculty' then delete from public.approver_scopes where user_id=_user_id; end if;
  end if;
  perform public.audit(case when _grant then 'Role granted' else 'Role revoked' end, _user_id, null, jsonb_build_object('role', _role));
end $$;

CREATE OR REPLACE FUNCTION public.admin_set_suspension(_user uuid, _suspend boolean, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only administrators can suspend accounts'; end if;
  if _user = auth.uid() then raise exception 'You cannot suspend yourself'; end if;
  if _suspend and coalesce(trim(_reason),'')='' then raise exception 'Give a reason for the suspension'; end if;
  if _suspend and exists(select 1 from public.user_roles where user_id=_user and role='super_admin')
     and (select count(*) from public.user_roles r where r.role='super_admin' and r.user_id<>_user and not public.is_suspended(r.user_id)) = 0 then
    raise exception 'At least one active super administrator must remain';
  end if;
  insert into public.account_status(user_id, suspended, reason, updated_by, updated_at) values (_user, _suspend, nullif(trim(_reason),''), auth.uid(), now())
  on conflict (user_id) do update set suspended=excluded.suspended, reason=excluded.reason, updated_by=excluded.updated_by, updated_at=now();
  perform public.audit(case when _suspend then 'Account suspended' else 'Account reinstated' end, _user, null, jsonb_build_object('reason', _reason));
end $$;

CREATE OR REPLACE FUNCTION public.admin_set_approver_scope(_user uuid, _scope uuid, _grant boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare sname text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only administrators can assign approvers'; end if;
  if _grant and not exists(select 1 from public.user_roles where user_id=_user and role in ('faculty','super_admin')) then raise exception 'Grant approver access first'; end if;
  if _grant then insert into public.approver_scopes(user_id, scope_id, granted_by) values (_user,_scope,auth.uid()) on conflict do nothing;
  else delete from public.approver_scopes where user_id=_user and scope_id=_scope; end if;
  select name into sname from public.scopes where id=_scope;
  perform public.audit(case when _grant then 'Approver assigned' else 'Approver unassigned' end, _user, _scope, jsonb_build_object('scope', sname));
end $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_scope(_id uuid, _kind text, _name text, _active boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare sid uuid;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only administrators can manage scopes'; end if;
  if coalesce(trim(_name),'')='' then raise exception 'Name is required'; end if;
  if _id is null then insert into public.scopes(kind, name) values (_kind, trim(_name)) returning id into sid;
  else update public.scopes set kind=_kind, name=trim(_name), active=_active where id=_id returning id into sid; end if;
  perform public.audit(case when _id is null then 'Scope created' else 'Scope updated' end, null, sid, jsonb_build_object('kind',_kind,'name',_name,'active',_active));
  return sid;
end $$;

CREATE OR REPLACE FUNCTION public.admin_assign_claim(_claim uuid, _reviewer uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare c record; nm text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only administrators can reassign claims'; end if;
  select * into c from public.claims where id=_claim for update;
  if c.status not in ('submitted','under_review') then raise exception 'Only claims awaiting review can be reassigned'; end if;
  if _reviewer is not null and not exists(select 1 from public.user_roles where user_id=_reviewer and role in ('faculty','super_admin')) then raise exception 'That person is not an approver'; end if;
  if _reviewer is not null and exists(select 1 from public.students s where s.id=c.student_id and s.user_id=_reviewer) then raise exception 'A claimant cannot review their own claim'; end if;
  perform set_config('app.trusted','on',true);
  update public.claims set assigned_faculty=_reviewer where id=_claim;
  select full_name into nm from public.profiles where id=_reviewer;
  insert into public.claim_events(claim_id, actor, actor_name, action, note) values (_claim, auth.uid(), public.actor_name(), 'Reviewer assigned', coalesce(nm,'Unassigned'));
  perform public.audit('Claim reassigned', _reviewer, _claim, jsonb_build_object('ref', c.ref, 'reviewer', nm));
  if _reviewer is not null then
    perform public.notify_user(_reviewer, 'claim', 'claim_assigned', c.ref || ' assigned to you', 'Claim ' || c.ref || ' ("' || c.title || '") was assigned to you for review.', 'assign:' || _claim || ':' || _reviewer || ':' || extract(epoch from now())::bigint, _claim, null);
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.admin_retry_notification(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only administrators can retry emails'; end if;
  update public.notifications set status='queued', last_error=null where id=_id and status='failed';
  perform public.audit('Email retry queued', null, _id, null);
end $$;

CREATE OR REPLACE FUNCTION public.request_role(_role app_role) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin raise exception 'Use the access request form'; end $$;

-- ===== Claim workflow changes =====
CREATE OR REPLACE FUNCTION public.guard_claim_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  if current_setting('app.trusted', true) = 'on' then new.updated_at = now(); return new; end if;
  if new.status <> old.status or new.approved_paise is distinct from old.approved_paise
     or new.advance_applied_paise <> old.advance_applied_paise or new.settlement_status <> old.settlement_status
     or new.claimed_paise <> old.claimed_paise or new.student_id <> old.student_id or new.ref <> old.ref
     or new.beneficiary_snapshot is distinct from old.beneficiary_snapshot
     or new.assigned_faculty is distinct from old.assigned_faculty then
    raise exception 'This field can only change through the workflow';
  end if;
  new.updated_at = now();
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.submit_claim(_claim uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare c record; total bigint; bad int; b record; sc record; a record; napprovers int := 0;
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
  for a in select s.user_id from public.approver_scopes s join public.user_roles r on r.user_id=s.user_id and r.role='faculty'
           where s.scope_id=c.scope_id and not public.is_suspended(s.user_id) and s.user_id <> auth.uid() loop
    napprovers := napprovers + 1;
    perform public.notify_user(a.user_id, 'claim', 'claim_to_review', c.ref || ' needs your review',
      'A claim "' || c.title || '" for ' || public.fmt_inr(total) || ' was submitted under ' || sc.name || '.', _claim || ':review:' || a.user_id || ':' || extract(epoch from now())::bigint, _claim, null);
  end loop;
  perform public.notify_admins('claim', case when napprovers=0 then 'claim_unassigned' else 'claim_new' end,
    c.ref || case when napprovers=0 then ' submitted — no approver assigned' else ' submitted' end,
    'Claim "' || c.title || '" for ' || public.fmt_inr(total) || ' was submitted under ' || sc.name || '.'
      || case when napprovers=0 then ' No approver covers this scope yet; assign one in Admin.' else '' end,
    _claim || ':admin:' || extract(epoch from now())::bigint, _claim, null);
  perform public.enqueue_notice(_claim, 'submitted', c.ref || ' submitted',
    'Your claim ' || c.ref || ' ("' || c.title || '") for ' || public.fmt_inr(total) || ' has been submitted. '
      || case when napprovers=0 then 'Reviewer assignment is pending; the administrator has been notified.' else 'It is waiting for review.' end,
    _claim || ':submitted:' || extract(epoch from now())::bigint);
end $$;

CREATE OR REPLACE FUNCTION public.start_review(_claim uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare c record;
begin
  if not public.can_review_claim(_claim) then raise exception 'You are not an approver for this claim'; end if;
  select * into c from public.claims where id=_claim for update;
  if c.status <> 'submitted' then return; end if;
  perform set_config('app.trusted','on',true);
  update public.claims set status='under_review', assigned_faculty=coalesce(assigned_faculty, auth.uid()) where id=_claim;
  insert into public.claim_events(claim_id, actor, actor_name, from_status, to_status, action)
  values (_claim, auth.uid(), public.actor_name(), 'submitted', 'under_review', 'Review started');
end $$;

CREATE OR REPLACE FUNCTION public.decide_claim(_claim uuid, _decision text, _note text, _items jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare c record; it jsonb; e record; ap bigint; total bigint := 0; newstatus claim_status; reduced boolean := false;
begin
  if public.is_own_claim(_claim) then raise exception 'You cannot review your own claim'; end if;
  if not public.can_review_claim(_claim) then raise exception 'You are not an approver for this claim'; end if;
  select * into c from public.claims where id=_claim for update;
  if c.status not in ('submitted','under_review') then raise exception 'This claim is not awaiting review'; end if;
  if _decision='approve' and exists(select 1 from public.duplicate_flags where claim_id=_claim and severity='exact' and resolved_at is null) then
    raise exception 'Resolve exact-duplicate flags before approving';
  end if;
  perform set_config('app.trusted','on',true);
  if _decision = 'approve' then
    for e in select * from public.expenses where claim_id=_claim loop
      it := null;
      select x into it from jsonb_array_elements(coalesce(_items,'[]'::jsonb)) x where x->>'expense_id' = e.id::text limit 1;
      ap := coalesce((it->>'approved_paise')::bigint, e.amount_paise);
      if ap < 0 or ap > e.amount_paise then raise exception 'Approved amount cannot exceed the claimed amount'; end if;
      if ap < e.amount_paise then
        reduced := true;
        if coalesce(trim(it->>'note'),'') = '' then raise exception 'Give a reason for each reduced expense'; end if;
      end if;
      update public.expenses set approved_paise=ap, review_note=nullif(trim(it->>'note'),'') where id=e.id;
      total := total + ap;
    end loop;
    newstatus := 'approved';
    update public.claims set status='approved', approved_paise=total, decided_at=now(), assigned_faculty=coalesce(assigned_faculty,auth.uid()),
      settlement_status = case when total - c.advance_applied_paise = 0 then 'settled'::settlement_status else 'pending'::settlement_status end
      where id=_claim;
  elsif _decision = 'changes' then
    if coalesce(trim(_note),'') = '' then raise exception 'Explain what needs to change'; end if;
    newstatus := 'changes_requested';
    update public.claims set status='changes_requested', beneficiary_confirmed=false where id=_claim;
    update public.expenses set confirmed_at=null where claim_id=_claim;
  elsif _decision = 'reject' then
    if coalesce(trim(_note),'') = '' then raise exception 'A reason is required to reject'; end if;
    newstatus := 'rejected';
    update public.claims set status='rejected', approved_paise=0, decided_at=now() where id=_claim;
  else raise exception 'Unknown decision'; end if;

  insert into public.claim_events(claim_id, actor, actor_name, from_status, to_status, action, note)
  values (_claim, auth.uid(), public.actor_name(), c.status, newstatus,
    case _decision when 'approve' then case when reduced then 'Partially approved' else 'Approved' end when 'changes' then 'Changes requested' else 'Rejected' end, nullif(trim(_note),''));
  if public.is_admin(auth.uid()) and not public.has_role_strict(auth.uid(),'faculty') then
    perform public.audit('Admin claim decision', null, _claim, jsonb_build_object('ref', c.ref, 'decision', _decision));
  end if;

  perform public.enqueue_notice(_claim, _decision,
    c.ref || case _decision when 'approve' then ' approved' when 'changes' then ': changes requested' else ' rejected' end,
    case _decision
      when 'approve' then 'Your claim ' || c.ref || ' was approved for ' || public.fmt_inr(total) || ' of ' || public.fmt_inr(c.claimed_paise) || ' claimed. Payment has not been made yet; finance will record the settlement separately.'
      when 'changes' then 'Your approver requested changes to ' || c.ref || ': ' || _note
      else 'Your claim ' || c.ref || ' was rejected. Reason: ' || _note end,
    _claim || ':' || _decision || ':' || extract(epoch from now())::bigint);
end $$;

CREATE OR REPLACE FUNCTION public.has_role_strict(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

CREATE OR REPLACE FUNCTION public.resolve_flag(_flag uuid, _resolution text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare cid uuid;
begin
  select claim_id into cid from public.duplicate_flags where id=_flag;
  if not public.can_review_claim(cid) then raise exception 'You are not an approver for this claim'; end if;
  if coalesce(trim(_resolution),'')='' then raise exception 'Document how this flag was resolved'; end if;
  update public.duplicate_flags set resolved_by=auth.uid(), resolution=_resolution, resolved_at=now() where id=_flag and resolved_at is null;
  insert into public.claim_events(claim_id, actor, actor_name, action, note) values (cid, auth.uid(), public.actor_name(), 'Flag resolved', _resolution);
end $$;

-- ===== Execute permissions =====
REVOKE EXECUTE ON FUNCTION public.audit(text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bootstrap_super_admin(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_confirmed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_access_request(app_role, uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.withdraw_access_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_access_request(uuid, boolean, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_suspension(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_approver_scope(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_scope(uuid, text, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_assign_claim(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_retry_notification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_access_request(app_role, uuid, text, jsonb), public.withdraw_access_request(uuid), public.decide_access_request(uuid, boolean, text, uuid),
  public.admin_set_suspension(uuid, boolean, text), public.admin_set_approver_scope(uuid, uuid, boolean), public.admin_upsert_scope(uuid, text, text, boolean),
  public.admin_assign_claim(uuid, uuid), public.admin_retry_notification(uuid), public.is_admin(uuid), public.is_suspended(uuid), public.can_review_claim(uuid) TO authenticated;

INSERT INTO public.scopes(kind, name) VALUES ('department','Information Technology') ON CONFLICT DO NOTHING;
