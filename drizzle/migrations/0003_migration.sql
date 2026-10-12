
alter table public.profiles add column college text, add column requested_role app_role;
alter table public.students add column college text;

create or replace function public.college_for_email(_email text) returns text language sql immutable as $$
  select case when lower(_email) like '%@pccoepune.org' then 'Pimpri Chinchwad College of Engineering, Pune' end
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email, college)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, public.college_for_email(new.email));
  if not exists (select 1 from public.user_roles where role = 'finance') then
    insert into public.user_roles(user_id, role) values (new.id, 'finance');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'student');
  end if;
  return new;
end $$;

-- college is derived from the verified email for college-domain accounts
create or replace function public.apply_college() returns trigger language plpgsql set search_path=public as $$
begin
  if public.college_for_email(new.email) is not null then new.college := public.college_for_email(new.email); end if;
  return new;
end $$;
create trigger students_college before insert or update on public.students for each row execute function public.apply_college();
create trigger profiles_college before insert or update on public.profiles for each row execute function public.apply_college();

-- users can only request faculty/finance access; finance approves via set_user_role
create or replace function public.request_role(_role app_role) returns void language plpgsql security definer set search_path=public as $$
begin
  if _role = 'student' then raise exception 'Students do not need approval'; end if;
  update public.profiles set requested_role = _role where id = auth.uid();
end $$;
revoke execute on function public.request_role(app_role) from public, anon;
grant execute on function public.request_role(app_role) to authenticated;

create or replace function public.set_user_role(_user_id uuid, _role app_role, _grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'finance') then raise exception 'Only finance staff can change roles'; end if;
  if _user_id = auth.uid() then raise exception 'You cannot change your own roles'; end if;
  if _grant then
    insert into public.user_roles(user_id, role) values (_user_id,_role) on conflict do nothing;
    update public.profiles set requested_role = null where id = _user_id and requested_role = _role;
  else delete from public.user_roles where user_id=_user_id and role=_role; end if;
end $$;

-- stop users editing requested_role directly (must use request_role)
create or replace function public.guard_profile_update() returns trigger language plpgsql set search_path=public as $$
begin
  if current_user = 'authenticated' and new.requested_role is distinct from old.requested_role then
    raise exception 'Use the access request option';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();

update public.profiles set college = public.college_for_email(email) where public.college_for_email(email) is not null;
