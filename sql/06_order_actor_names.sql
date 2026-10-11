-- Existing installations: run once (safe to repeat). Fresh installs include this in 03.
begin;
-- Read only the names of people who acted on this order. Profiles RLS stays unchanged.
create or replace function public.get_order_actor_names(p_order uuid)
returns table(id uuid, username text, full_name text)
language sql stable security definer set search_path = '' as $$
  with actors as (
    select created_by as actor_id from public.orders where id = p_order
    union select acknowledged_by from public.orders where id = p_order
    union select created_by from public.order_issues where order_id = p_order
    union select created_by from public.order_receipts where order_id = p_order
    union select created_by from public.process_logs where order_id = p_order
    union select created_by from public.inspections where order_id = p_order
    union select created_by from public.warehouse_receipts where order_id = p_order
    union select changed_by from public.status_history where order_id = p_order
    union select created_by from public.status_history where order_id = p_order
    union select created_by from public.change_audit where order_id = p_order
  )
  select p.id, p.username, p.full_name
  from public.profiles p join actors a on a.actor_id = p.id
  where public.get_my_role() is not null
    and exists (select 1 from public.orders o where o.id = p_order)
$$;
revoke all on function public.get_order_actor_names(uuid) from public, anon;
grant execute on function public.get_order_actor_names(uuid) to authenticated;
commit;
