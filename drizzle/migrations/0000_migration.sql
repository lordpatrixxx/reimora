
create type public.app_role as enum ('student','faculty','finance');
create type public.claim_status as enum ('draft','submitted','under_review','changes_requested','rejected','approved');
create type public.settlement_status as enum ('not_applicable','pending','partially_settled','settled');
create type public.expense_category as enum ('Stationery','Refreshment','Rent','Design Material','Printing','Travel','Equipment','Other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _uid and role in ('faculty','finance'))
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'finance'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email);
  if not exists (select 1 from public.user_roles where role = 'finance') then
    insert into public.user_roles(user_id, role) values (new.id, 'finance');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'student');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.set_user_role(_user_id uuid, _role app_role, _grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'finance') then raise exception 'Only finance staff can change roles'; end if;
  if _user_id = auth.uid() then raise exception 'You cannot change your own roles'; end if;
  if _grant then insert into public.user_roles(user_id, role) values (_user_id,_role) on conflict do nothing;
  else delete from public.user_roles where user_id=_user_id and role=_role; end if;
end $$;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  full_name text not null,
  prn text not null unique,
  department text not null default 'Information Technology',
  year text, division text,
  email text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.students to authenticated;
grant all on public.students to service_role;
alter table public.students enable row level security;
create policy "students read" on public.students for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "finance manage students" on public.students for all to authenticated using (public.has_role(auth.uid(),'finance')) with check (public.has_role(auth.uid(),'finance'));
create policy "student self-link" on public.students for insert to authenticated with check (user_id = auth.uid());

create or replace function public.my_student_id() returns uuid language sql stable security definer set search_path=public as $$
  select id from public.students where user_id = auth.uid()
$$;

create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  holder_name text not null,
  bank_name text not null,
  account_last4 text not null check (account_last4 ~ '^[0-9]{4}$'),
  ifsc text not null check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  is_default boolean not null default false,
  is_active boolean not null default true,
  is_fictional boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.beneficiaries to authenticated;
grant all on public.beneficiaries to service_role;
alter table public.beneficiaries enable row level security;
create policy "beneficiary read" on public.beneficiaries for select to authenticated using (public.is_staff(auth.uid()) or student_id = public.my_student_id());
create policy "beneficiary finance write" on public.beneficiaries for insert to authenticated with check (public.has_role(auth.uid(),'finance'));
create policy "beneficiary finance update" on public.beneficiaries for update to authenticated using (public.has_role(auth.uid(),'finance'));

create table public.beneficiary_history (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null,
  changed_by uuid,
  old_values jsonb, new_values jsonb,
  created_at timestamptz not null default now()
);
grant select on public.beneficiary_history to authenticated;
grant all on public.beneficiary_history to service_role;
alter table public.beneficiary_history enable row level security;
create policy "history finance read" on public.beneficiary_history for select to authenticated using (public.has_role(auth.uid(),'finance'));

create or replace function public.log_beneficiary_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.beneficiary_history(beneficiary_id, changed_by, old_values, new_values)
  values (new.id, auth.uid(), case when tg_op='UPDATE' then to_jsonb(old) end, to_jsonb(new));
  if new.is_default then
    update public.beneficiaries set is_default=false where student_id=new.student_id and id<>new.id and is_default;
  end if;
  return new;
end $$;
create trigger beneficiary_audit after insert or update on public.beneficiaries for each row execute function public.log_beneficiary_change();

create sequence public.claim_ref_seq start 1001;
grant usage on sequence public.claim_ref_seq to authenticated;
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('CS-' || nextval('public.claim_ref_seq')),
  title text not null,
  purpose text not null default '',
  student_id uuid not null references public.students(id),
  created_by uuid not null default auth.uid(),
  assigned_faculty uuid,
  status claim_status not null default 'draft',
  settlement_status settlement_status not null default 'not_applicable',
  beneficiary_id uuid references public.beneficiaries(id),
  beneficiary_snapshot jsonb,
  beneficiary_confirmed boolean not null default false,
  claimed_paise bigint not null default 0,
  approved_paise bigint,
  advance_applied_paise bigint not null default 0,
  wizard_step int not null default 1,
  submitted_at timestamptz, decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.claims to authenticated;
grant all on public.claims to service_role;
alter table public.claims enable row level security;

create or replace function public.can_view_claim(_claim uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.claims c where c.id=_claim and (
    c.student_id = public.my_student_id() or c.created_by = auth.uid()
    or public.has_role(auth.uid(),'finance')
    or (public.has_role(auth.uid(),'faculty') and c.status <> 'draft' and (c.assigned_faculty is null or c.assigned_faculty = auth.uid()))
  ))
$$;
create or replace function public.can_edit_claim(_claim uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.claims c where c.id=_claim and c.status in ('draft','changes_requested') and (
    c.student_id = public.my_student_id() or c.created_by = auth.uid() or public.has_role(auth.uid(),'finance')))
$$;

create policy "claims read" on public.claims for select to authenticated using (public.can_view_claim(id));
create policy "claims create" on public.claims for insert to authenticated with check (
  status='draft' and created_by = auth.uid() and (student_id = public.my_student_id() or public.has_role(auth.uid(),'finance')));
create policy "claims edit drafts" on public.claims for update to authenticated using (public.can_edit_claim(id)) with check (status in ('draft','changes_requested'));
create policy "claims delete drafts" on public.claims for delete to authenticated using (status='draft' and public.can_edit_claim(id));

create or replace function public.guard_claim_update() returns trigger language plpgsql set search_path=public as $$
begin
  if current_setting('app.trusted', true) = 'on' then new.updated_at = now(); return new; end if;
  if new.status <> old.status or new.approved_paise is distinct from old.approved_paise
     or new.advance_applied_paise <> old.advance_applied_paise or new.settlement_status <> old.settlement_status
     or new.claimed_paise <> old.claimed_paise or new.student_id <> old.student_id or new.ref <> old.ref
     or new.beneficiary_snapshot is distinct from old.beneficiary_snapshot then
    raise exception 'This field can only change through the workflow';
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger claims_guard before update on public.claims for each row execute function public.guard_claim_update();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  description text not null default '',
  vendor text,
  category expense_category,
  expense_date date,
  invoice_no text,
  txn_ref text,
  amount_paise bigint check (amount_paise is null or amount_paise > 0),
  approved_paise bigint,
  review_note text,
  extraction jsonb,
  extraction_at timestamptz,
  extraction_rescan jsonb,
  confirmed_at timestamptz,
  confirmed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "expenses read" on public.expenses for select to authenticated using (public.can_view_claim(claim_id));
create policy "expenses write" on public.expenses for insert to authenticated with check (public.can_edit_claim(claim_id));
create policy "expenses update" on public.expenses for update to authenticated using (public.can_edit_claim(claim_id));
create policy "expenses delete" on public.expenses for delete to authenticated using (public.can_edit_claim(claim_id));

create or replace function public.guard_expense_update() returns trigger language plpgsql set search_path=public as $$
begin
  if current_setting('app.trusted', true) = 'on' then return new; end if;
  if new.approved_paise is distinct from old.approved_paise or new.review_note is distinct from old.review_note then
    raise exception 'Approved amounts are set by faculty review';
  end if;
  if old.extraction is not null and new.extraction is distinct from old.extraction then
    raise exception 'Original extraction cannot be changed';
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger expenses_guard before update on public.expenses for each row execute function public.guard_expense_update();

create table public.expense_edits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  edited_by uuid, old_values jsonb, new_values jsonb,
  created_at timestamptz not null default now()
);
grant select on public.expense_edits to authenticated;
grant all on public.expense_edits to service_role;
alter table public.expense_edits enable row level security;
create policy "edits read" on public.expense_edits for select to authenticated using (exists(select 1 from public.expenses e where e.id=expense_id and public.can_view_claim(e.claim_id)));
create or replace function public.log_expense_edit() returns trigger language plpgsql security definer set search_path=public as $$
declare o jsonb; n jsonb;
begin
  o := jsonb_build_object('vendor',old.vendor,'category',old.category,'expense_date',old.expense_date,'amount_paise',old.amount_paise,'invoice_no',old.invoice_no,'txn_ref',old.txn_ref,'description',old.description,'confirmed',old.confirmed_at is not null);
  n := jsonb_build_object('vendor',new.vendor,'category',new.category,'expense_date',new.expense_date,'amount_paise',new.amount_paise,'invoice_no',new.invoice_no,'txn_ref',new.txn_ref,'description',new.description,'confirmed',new.confirmed_at is not null);
  if o <> n then
    insert into public.expense_edits(expense_id, edited_by, old_values, new_values) values (new.id, auth.uid(), o, n);
  end if;
  return new;
end $$;
create trigger expenses_log after update on public.expenses for each row execute function public.log_expense_edit();

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null,
  sha256 text,
  kind text not null default 'receipt' check (kind in ('receipt','upi_screenshot','supporting')),
  rotation int not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, update, delete on public.attachments to authenticated;
grant all on public.attachments to service_role;
alter table public.attachments enable row level security;
create policy "attachments read" on public.attachments for select to authenticated using (public.can_view_claim(claim_id));
create policy "attachments update" on public.attachments for update to authenticated using (public.can_edit_claim(claim_id));
create policy "attachments delete" on public.attachments for delete to authenticated using (public.can_edit_claim(claim_id));

create table public.claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  actor uuid, actor_name text,
  from_status claim_status, to_status claim_status,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.claim_events to authenticated;
grant all on public.claim_events to service_role;
alter table public.claim_events enable row level security;
create policy "events read" on public.claim_events for select to authenticated using (public.can_view_claim(claim_id));

create table public.duplicate_flags (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  expense_id uuid references public.expenses(id) on delete cascade,
  severity text not null check (severity in ('exact','possible','mismatch')),
  reason text not null,
  resolved_by uuid, resolution text, resolved_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.duplicate_flags to authenticated;
grant all on public.duplicate_flags to service_role;
alter table public.duplicate_flags enable row level security;
create policy "flags read" on public.duplicate_flags for select to authenticated using (public.can_view_claim(claim_id));

create table public.advances (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  purpose text not null,
  amount_paise bigint not null check (amount_paise > 0),
  allocated_paise bigint not null default 0,
  issued_on date not null default current_date,
  reference text,
  recorded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (allocated_paise >= 0 and allocated_paise <= amount_paise)
);
grant select, insert on public.advances to authenticated;
grant all on public.advances to service_role;
alter table public.advances enable row level security;
create policy "advances read" on public.advances for select to authenticated using (public.is_staff(auth.uid()) or student_id = public.my_student_id());
create policy "advances insert" on public.advances for insert to authenticated with check (public.has_role(auth.uid(),'finance') and allocated_paise = 0);

create table public.advance_allocations (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references public.advances(id),
  claim_id uuid not null references public.claims(id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  allocated_by uuid,
  created_at timestamptz not null default now(),
  unique (advance_id, claim_id)
);
grant select on public.advance_allocations to authenticated;
grant all on public.advance_allocations to service_role;
alter table public.advance_allocations enable row level security;
create policy "alloc read" on public.advance_allocations for select to authenticated using (public.can_view_claim(claim_id));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id),
  direction text not null check (direction in ('to_student','from_student')),
  amount_paise bigint not null check (amount_paise > 0),
  paid_on date not null,
  reference text not null,
  beneficiary_snapshot jsonb,
  recorded_by uuid, recorded_by_name text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "payments read" on public.payments for select to authenticated using (public.can_view_claim(claim_id));

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.claims(id) on delete cascade,
  recipient_user uuid,
  recipient_email text not null,
  kind text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  attempts int not null default 0,
  last_error text,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notif read" on public.notifications for select to authenticated using (recipient_user = auth.uid() or public.has_role(auth.uid(),'finance'));
create policy "notif mark read" on public.notifications for update to authenticated using (recipient_user = auth.uid());

create or replace function public.actor_name() returns text language sql stable security definer set search_path=public as $$
  select coalesce(full_name, email, 'Someone') from public.profiles where id = auth.uid()
$$;

create or replace function public.fmt_inr(_p bigint) returns text language sql immutable as $$
  select '₹' || to_char(coalesce(_p,0)/100.0, 'FM99,99,99,990.00')
$$;

create or replace function public.enqueue_notice(_claim uuid, _kind text, _subject text, _body text, _dedupe text)
returns void language plpgsql security definer set search_path=public as $$
declare s record;
begin
  select st.email, st.user_id into s from public.claims c join public.students st on st.id=c.student_id where c.id=_claim;
  insert into public.notifications(claim_id, recipient_user, recipient_email, kind, subject, body, dedupe_key)
  values (_claim, s.user_id, s.email, _kind, _subject, _body, _dedupe)
  on conflict (dedupe_key) do nothing;
end $$;

create or replace function public.detect_duplicates(_claim uuid) returns void language plpgsql security definer set search_path=public as $$
declare e record; a record; n int;
begin
  delete from public.duplicate_flags where claim_id=_claim and resolved_at is null;
  for a in select * from public.attachments where claim_id=_claim and sha256 is not null loop
    if exists(select 1 from public.attachments x join public.claims c on c.id=x.claim_id
              where x.sha256=a.sha256 and x.claim_id<>_claim and c.status<>'draft') then
      insert into public.duplicate_flags(claim_id, expense_id, severity, reason)
      values (_claim, a.expense_id, 'exact', 'The file "' || a.file_name || '" is identical to evidence already used in another submitted claim.');
    end if;
    select count(*) into n from public.attachments where claim_id=_claim and sha256=a.sha256 and id<>a.id and expense_id<>a.expense_id;
    if n > 0 then
      insert into public.duplicate_flags(claim_id, expense_id, severity, reason)
      values (_claim, a.expense_id, 'exact', 'The same file is attached to more than one expense in this claim.');
    end if;
  end loop;
  for e in select * from public.expenses where claim_id=_claim loop
    if e.txn_ref is not null and exists(select 1 from public.expenses x join public.claims c on c.id=x.claim_id
        where lower(x.txn_ref)=lower(e.txn_ref) and x.id<>e.id and (x.claim_id=_claim or c.status<>'draft')) then
      insert into public.duplicate_flags(claim_id, expense_id, severity, reason)
      values (_claim, e.id, 'exact', 'Transaction reference ' || e.txn_ref || ' has already been used in another expense.');
    end if;
    if e.vendor is not null and exists(select 1 from public.expenses x join public.claims c on c.id=x.claim_id
        where x.id<>e.id and c.status<>'draft' and x.claim_id<>_claim and lower(x.vendor)=lower(e.vendor)
        and ((e.invoice_no is not null and lower(x.invoice_no)=lower(e.invoice_no))
             or (x.expense_date=e.expense_date and x.amount_paise=e.amount_paise))) then
      insert into public.duplicate_flags(claim_id, expense_id, severity, reason)
      values (_claim, e.id, 'possible', 'Another submitted expense has the same vendor and a matching invoice number, or the same date and amount.');
    end if;
    if coalesce((e.extraction->>'amount_mismatch')::boolean, false) then
      insert into public.duplicate_flags(claim_id, expense_id, severity, reason)
      values (_claim, e.id, 'mismatch', 'Receipt and payment screenshot show different amounts.');
    end if;
    if upper(coalesce(e.extraction->'facts'->>'payment_status','')) in ('FAILED','PENDING') then
      insert into public.duplicate_flags(claim_id, expense_id, severity, reason)
      values (_claim, e.id, 'mismatch', 'The document displays a ' || lower(e.extraction->'facts'->>'payment_status') || ' payment status.');
    end if;
  end loop;
end $$;

create or replace function public.submit_claim(_claim uuid) returns void language plpgsql security definer set search_path=public as $$
declare c record; total bigint; bad int; b record;
begin
  select * into c from public.claims where id=_claim for update;
  if c is null or not public.can_edit_claim(_claim) then raise exception 'You cannot submit this claim'; end if;
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
  perform public.enqueue_notice(_claim, 'submitted', c.ref || ' submitted',
    'Your claim ' || c.ref || ' ("' || c.title || '") for ' || public.fmt_inr(total) || ' has been submitted and is waiting for faculty review.',
    _claim || ':submitted:' || extract(epoch from now())::bigint);
end $$;

create or replace function public.start_review(_claim uuid) returns void language plpgsql security definer set search_path=public as $$
declare c record;
begin
  if not public.has_role(auth.uid(),'faculty') then raise exception 'Only faculty can review'; end if;
  select * into c from public.claims where id=_claim for update;
  if c.status <> 'submitted' then return; end if;
  perform set_config('app.trusted','on',true);
  update public.claims set status='under_review', assigned_faculty=coalesce(assigned_faculty, auth.uid()) where id=_claim;
  insert into public.claim_events(claim_id, actor, actor_name, from_status, to_status, action)
  values (_claim, auth.uid(), public.actor_name(), 'submitted', 'under_review', 'Review started');
end $$;

create or replace function public.decide_claim(_claim uuid, _decision text, _note text, _items jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare c record; it jsonb; e record; ap bigint; total bigint := 0; newstatus claim_status; reduced boolean := false;
begin
  if not public.has_role(auth.uid(),'faculty') then raise exception 'Only faculty can decide claims'; end if;
  select * into c from public.claims where id=_claim for update;
  if c.status not in ('submitted','under_review') then raise exception 'This claim is not awaiting review'; end if;
  if c.assigned_faculty is not null and c.assigned_faculty <> auth.uid() then raise exception 'This claim is assigned to another reviewer'; end if;
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

  perform public.enqueue_notice(_claim, _decision,
    c.ref || case _decision when 'approve' then ' approved' when 'changes' then ': changes requested' else ' rejected' end,
    case _decision
      when 'approve' then 'Your claim ' || c.ref || ' was approved for ' || public.fmt_inr(total) || ' of ' || public.fmt_inr(c.claimed_paise) || ' claimed. Payment has not been made yet; finance will record the settlement separately.'
      when 'changes' then 'Faculty requested changes to ' || c.ref || ': ' || _note
      else 'Your claim ' || c.ref || ' was rejected. Reason: ' || _note end,
    _claim || ':' || _decision || ':' || extract(epoch from now())::bigint);
end $$;

create or replace function public.resolve_flag(_flag uuid, _resolution text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'faculty') then raise exception 'Only faculty can resolve flags'; end if;
  if coalesce(trim(_resolution),'')='' then raise exception 'Document how this flag was resolved'; end if;
  update public.duplicate_flags set resolved_by=auth.uid(), resolution=_resolution, resolved_at=now() where id=_flag and resolved_at is null;
  insert into public.claim_events(claim_id, actor, actor_name, action, note)
  select claim_id, auth.uid(), public.actor_name(), 'Flag resolved', _resolution from public.duplicate_flags where id=_flag;
end $$;

create or replace function public.recompute_settlement(_claim uuid) returns void language plpgsql security definer set search_path=public as $$
declare c record; net bigint; paid_to bigint; paid_from bigint; s settlement_status;
begin
  select * into c from public.claims where id=_claim;
  if c.status <> 'approved' then return; end if;
  net := c.approved_paise - c.advance_applied_paise;
  select coalesce(sum(amount_paise) filter (where direction='to_student'),0), coalesce(sum(amount_paise) filter (where direction='from_student'),0)
    into paid_to, paid_from from public.payments where claim_id=_claim;
  if net > 0 then s := case when paid_to >= net then 'settled' when paid_to > 0 then 'partially_settled' else 'pending' end;
  elsif net < 0 then s := case when paid_from >= -net then 'settled' when paid_from > 0 then 'partially_settled' else 'pending' end;
  else s := 'settled'; end if;
  perform set_config('app.trusted','on',true);
  update public.claims set settlement_status=s where id=_claim;
end $$;

create or replace function public.allocate_advance(_claim uuid, _advance uuid, _amount bigint) returns void language plpgsql security definer set search_path=public as $$
declare c record; a record;
begin
  if not public.has_role(auth.uid(),'finance') then raise exception 'Only finance can apply advances'; end if;
  if _amount <= 0 then raise exception 'Amount must be positive'; end if;
  select * into c from public.claims where id=_claim for update;
  select * into a from public.advances where id=_advance for update;
  if a is null or a.student_id <> c.student_id then raise exception 'Advance belongs to a different student'; end if;
  if c.status in ('rejected','draft') then raise exception 'Advances can be applied to submitted or approved claims only'; end if;
  if exists(select 1 from public.payments where claim_id=_claim) then raise exception 'Payments already recorded; advance allocation is locked'; end if;
  if a.allocated_paise + _amount > a.amount_paise then raise exception 'Only % of this advance is still unallocated', public.fmt_inr(a.amount_paise - a.allocated_paise); end if;
  insert into public.advance_allocations(advance_id, claim_id, amount_paise, allocated_by) values (_advance,_claim,_amount,auth.uid());
  update public.advances set allocated_paise = allocated_paise + _amount where id=_advance;
  perform set_config('app.trusted','on',true);
  update public.claims set advance_applied_paise = advance_applied_paise + _amount where id=_claim;
  insert into public.claim_events(claim_id, actor, actor_name, action, note)
  values (_claim, auth.uid(), public.actor_name(), 'Advance applied', public.fmt_inr(_amount) || ' from "' || a.purpose || '"');
  perform public.recompute_settlement(_claim);
end $$;

create or replace function public.record_payment(_claim uuid, _direction text, _amount bigint, _paid_on date, _reference text, _key text)
returns void language plpgsql security definer set search_path=public as $$
declare c record; net bigint; done bigint; remaining bigint;
begin
  if not public.has_role(auth.uid(),'finance') then raise exception 'Only finance can record payments'; end if;
  select * into c from public.claims where id=_claim for update;
  if exists(select 1 from public.payments where idempotency_key=_key) then return; end if;
  if coalesce(trim(_reference),'')='' then raise exception 'A payment reference is required'; end if;
  if _amount <= 0 then raise exception 'Amount must be positive'; end if;
  if c.status <> 'approved' then raise exception 'Only approved claims can be settled'; end if;
  net := c.approved_paise - c.advance_applied_paise;
  if (_direction='to_student' and net <= 0) or (_direction='from_student' and net >= 0) then raise exception 'Payment direction does not match the settlement'; end if;
  select coalesce(sum(amount_paise),0) into done from public.payments where claim_id=_claim and direction=_direction;
  remaining := abs(net) - done;
  if _amount > remaining then raise exception 'Amount exceeds the outstanding %', public.fmt_inr(remaining); end if;
  insert into public.payments(claim_id, direction, amount_paise, paid_on, reference, beneficiary_snapshot, recorded_by, recorded_by_name, idempotency_key)
  values (_claim, _direction, _amount, _paid_on, _reference, case when _direction='to_student' then c.beneficiary_snapshot end, auth.uid(), public.actor_name(), _key);
  insert into public.claim_events(claim_id, actor, actor_name, action, note)
  values (_claim, auth.uid(), public.actor_name(), case when _direction='to_student' then 'Reimbursement recorded' else 'Advance return recorded' end,
    public.fmt_inr(_amount) || ' · ref ' || _reference);
  perform public.recompute_settlement(_claim);
  perform public.enqueue_notice(_claim, 'payment_' || _direction,
    c.ref || case when _direction='to_student' then ': reimbursement recorded' else ': advance return recorded' end,
    case when _direction='to_student'
      then 'A reimbursement of ' || public.fmt_inr(_amount) || ' for ' || c.ref || ' was recorded (ref ' || _reference || ') to the account ending ' || coalesce(c.beneficiary_snapshot->>'account_last4','----') || '. Outstanding: ' || public.fmt_inr(remaining - _amount) || '.'
      else 'A return of ' || public.fmt_inr(_amount) || ' against your advance for ' || c.ref || ' was recorded. Still to return: ' || public.fmt_inr(remaining - _amount) || '.' end,
    'pay:' || _key);
end $$;

create policy "evidence read" on storage.objects for select to authenticated
  using (bucket_id='evidence' and public.can_view_claim(((storage.foldername(name))[1])::uuid));
create policy "evidence upload" on storage.objects for insert to authenticated
  with check (bucket_id='evidence' and public.can_edit_claim(((storage.foldername(name))[1])::uuid));
create policy "evidence delete" on storage.objects for delete to authenticated
  using (bucket_id='evidence' and public.can_edit_claim(((storage.foldername(name))[1])::uuid));
