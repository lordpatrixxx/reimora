
create or replace function public.guard_student_self() returns trigger language plpgsql set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'finance') and lower(new.email) <> lower(coalesce(auth.jwt()->>'email','')) then
    raise exception 'Student email must match your account email';
  end if;
  return new;
end $$;
