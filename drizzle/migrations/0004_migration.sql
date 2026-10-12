
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare req text := new.raw_user_meta_data->>'requested_role';
begin
  insert into public.profiles(id, full_name, email, college, requested_role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email,
    public.college_for_email(new.email), case when req in ('faculty','finance') then req::app_role end);
  if not exists (select 1 from public.user_roles where role = 'finance') then
    insert into public.user_roles(user_id, role) values (new.id, 'finance');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'student');
  end if;
  return new;
end $$;
