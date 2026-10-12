
revoke execute on function public.enqueue_notice(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.detect_duplicates(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_settlement(uuid) from public, anon, authenticated;
revoke execute on function public.submit_claim(uuid) from public, anon;
revoke execute on function public.start_review(uuid) from public, anon;
revoke execute on function public.decide_claim(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.resolve_flag(uuid, text) from public, anon;
revoke execute on function public.allocate_advance(uuid, uuid, bigint) from public, anon;
revoke execute on function public.record_payment(uuid, text, bigint, date, text, text) from public, anon;
revoke execute on function public.set_user_role(uuid, app_role, boolean) from public, anon;
grant execute on function public.submit_claim(uuid), public.start_review(uuid), public.decide_claim(uuid, text, text, jsonb),
  public.resolve_flag(uuid, text), public.allocate_advance(uuid, uuid, bigint), public.record_payment(uuid, text, bigint, date, text, text),
  public.set_user_role(uuid, app_role, boolean) to authenticated;

-- Notifications: users may only flip read_at
create or replace function public.guard_notification_update() returns trigger language plpgsql set search_path=public as $$
begin
  if current_user = 'authenticated' and (new.status <> old.status or new.body <> old.body or new.subject <> old.subject or new.attempts <> old.attempts or new.recipient_email <> old.recipient_email) then
    raise exception 'Only read status can be changed';
  end if;
  return new;
end $$;
create trigger notifications_guard before update on public.notifications for each row execute function public.guard_notification_update();

-- Attachments: users may only change rotation
create or replace function public.guard_attachment_update() returns trigger language plpgsql set search_path=public as $$
begin
  if current_user = 'authenticated' and (new.storage_path <> old.storage_path or new.sha256 is distinct from old.sha256 or new.expense_id <> old.expense_id or new.claim_id <> old.claim_id or new.mime_type <> old.mime_type) then
    raise exception 'Only rotation can be changed';
  end if;
  return new;
end $$;
create trigger attachments_guard before update on public.attachments for each row execute function public.guard_attachment_update();

-- Students: a self-linked student cannot rewrite user_id/email of their record via finance-only policy; enforce prn format sanity
create or replace function public.guard_student_self() returns trigger language plpgsql set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'finance') and new.email <> (select email from auth.users where id = auth.uid()) then
    raise exception 'Student email must match your account email';
  end if;
  return new;
end $$;
create trigger students_self_guard before insert on public.students for each row execute function public.guard_student_self();
