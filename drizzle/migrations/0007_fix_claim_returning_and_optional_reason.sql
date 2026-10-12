drop policy "claims read" on public.claims;

create policy "claims read"
  on public.claims
  for select
  to authenticated
  using (
    not public.is_suspended(auth.uid())
    and (
      student_id = public.my_student_id()
      or created_by = auth.uid()
      or public.has_role(auth.uid(), 'finance')
      or (
        public.has_role(auth.uid(), 'faculty')
        and status <> 'draft'
        and (
          assigned_faculty = auth.uid()
          or (assigned_faculty is null and public.in_my_scope(scope_id))
        )
      )
    )
  );

-- Access requests: the reason field is no longer collected; keep it optional.
create or replace function public.submit_access_request(_role app_role, _scope uuid, _scope_text text, _details jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare rid uuid; rref text; nm text; sname text; why text;
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
  why := nullif(left(_details->>'reason', 200), '');
  perform public.notify_admins('access', 'access_request',
    'New access request ' || rref || ': ' || nm,
    nm || ' requested ' || case when _role='student' then 'Student' else 'Faculty / Club Approver' end || ' access'
      || ' for ' || coalesce(sname, _scope_text, _details->>'department')
      || coalesce('. Reason: ' || why, '')
      || '. Request ' || rref || '. Review it at /admin/requests?id=' || rid || ' (sign-in required).',
    'ar:' || rid, null, rid);
  return rid;
end $function$;