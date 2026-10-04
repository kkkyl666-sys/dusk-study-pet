begin;

create table if not exists public.dusk_feedback_settings (
  id integer primary key check (id = 1),
  owner_hash text not null check (length(owner_hash) = 64)
);
create table if not exists public.dusk_feedback (
  id uuid primary key,
  client_id uuid not null,
  category text not null check (category in ('bug','idea','words','other')),
  body text not null check (length(body) between 5 and 5000),
  contact text not null default '' check (length(contact) <= 200),
  environment jsonb not null default '{}'::jsonb,
  version text not null check (length(version) <= 30),
  status text not null default 'new' check (status in ('new','working','done')),
  owner_note text not null default '' check (length(owner_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dusk_feedback_created_idx on public.dusk_feedback (created_at desc);
create index if not exists dusk_feedback_client_idx on public.dusk_feedback (client_id, created_at desc);
alter table public.dusk_feedback_settings enable row level security;
alter table public.dusk_feedback enable row level security;
revoke all on public.dusk_feedback_settings, public.dusk_feedback from public, anon, authenticated;

-- Installation injects an independent, random owner hash here, never in the web app.
-- ADMIN_SETUP

create or replace function public.dusk_feedback_submit(
  request_id uuid, device_id uuid, category text, body text,
  contact text default '', environment jsonb default '{}'::jsonb, app_version text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous_client uuid; total_rows bigint;
begin
  if not exists(select 1 from public.dusk_feedback_settings where id = 1) then
    raise exception 'Feedback not configured';
  end if;
  if request_id is null or device_id is null or category is null or category not in ('bug','idea','words','other')
    or body is null or length(btrim(body)) not between 5 and 5000
    or contact is null or length(contact) > 200 or app_version is null or length(app_version) > 30
    or environment is null or jsonb_typeof(environment) <> 'object' or octet_length(environment::text) > 1000
    or exists(select 1 from jsonb_object_keys(environment) as k where k not in ('platform','language','viewport'))
    or exists(select 1 from jsonb_each(environment) as e where jsonb_typeof(e.value) <> 'string' or length(e.value::text) > 300)
    then raise exception 'Invalid feedback';
  end if;
  -- Serialize quota checks and insertion, including concurrent retries.
  perform pg_catalog.pg_advisory_xact_lock(734261);
  select f.client_id into previous_client from public.dusk_feedback f where f.id = request_id;
  if found then
    if previous_client <> device_id then raise exception 'Invalid request'; end if;
    return jsonb_build_object('receipt',request_id,'delivered',true);
  end if;
  select count(*) into total_rows from public.dusk_feedback;
  if total_rows >= 5000
    or (select count(*) from public.dusk_feedback f where f.created_at >= now()-interval '1 hour') >= 30
    or (select count(*) from public.dusk_feedback f where f.created_at >= now()-interval '24 hours') >= 200
    or (select count(*) from public.dusk_feedback f where f.client_id = device_id and f.created_at >= now()-interval '10 minutes') >= 3
    then raise exception 'Feedback rate limited';
  end if;
  insert into public.dusk_feedback (id,client_id,category,body,contact,environment,version)
    values(request_id,device_id,category,btrim(body),btrim(contact),environment,app_version);
  return jsonb_build_object('receipt',request_id,'delivered',true);
end;
$$;

create or replace function public.dusk_feedback_owner_check(owner_key text)
returns boolean language sql security definer set search_path = '' as $$
  select length(owner_key) between 40 and 100 and exists (
    select 1 from public.dusk_feedback_settings s where s.id = 1
      and s.owner_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(owner_key,'UTF8')),'hex')
  );
$$;
revoke all on function public.dusk_feedback_owner_check(text) from public, anon, authenticated;

create or replace function public.dusk_feedback_list(owner_key text, before_date timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.dusk_feedback_owner_check(owner_key),false) then raise exception 'Owner access denied'; end if;
  return coalesce((select jsonb_agg(to_jsonb(items) order by created_at desc, id desc) from (
    select id,category,body,contact,environment,version,status,owner_note,created_at,updated_at
    from public.dusk_feedback where before_date is null or created_at < before_date
    order by created_at desc, id desc limit 100
  ) items),'[]'::jsonb);
end;
$$;
create or replace function public.dusk_feedback_update(owner_key text, feedback_id uuid, new_status text, note text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.dusk_feedback_owner_check(owner_key),false) then raise exception 'Owner access denied'; end if;
  if new_status is null or new_status not in ('new','working','done') or note is null or length(note) > 2000 then raise exception 'Invalid update'; end if;
  update public.dusk_feedback set status=new_status,owner_note=note,updated_at=now() where id=feedback_id;
  if not found then raise exception 'Feedback not found'; end if;
  return jsonb_build_object('updated',true);
end;
$$;
revoke all on function public.dusk_feedback_submit(uuid,uuid,text,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.dusk_feedback_list(text,timestamptz) from public, anon, authenticated;
revoke all on function public.dusk_feedback_update(text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.dusk_feedback_submit(uuid,uuid,text,text,text,jsonb,text) to anon, authenticated;
grant execute on function public.dusk_feedback_list(text,timestamptz) to anon, authenticated;
grant execute on function public.dusk_feedback_update(text,uuid,text,text) to anon, authenticated;
commit;
