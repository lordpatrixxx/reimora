create or replace function public.admin_retry_notification(_id uuid) returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Only administrators can retry emails'; end if;
  update public.notifications set status='queued', last_error=null, next_retry_at=null, attempts=least(attempts, 4)
  where id=_id and status in ('failed','permanently_failed');
  if not found then raise exception 'Only failed emails can be retried'; end if;
  perform public.audit('Email retry queued', null, _id, null);
end $function$;