begin;

create table public.churches (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  code text collate "C" not null unique,
  constraint churches_code_format check (
    code ~ '^([0-9]{6}|[A-Z][0-9]{5})$'
    and code not in ('002432', '274816')
  )
);

alter table public.churches enable row level security;
revoke all on public.churches from public, anon, authenticated, service_role;

create function public.register_church(input_id uuid, church_name text)
returns table (church_id uuid, code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reserved constant text[] := array['002432', '274816'];
  first_letter integer := floor(random() * 26)::integer;
  code_prefix text;
  pool_size integer;
  start_at integer;
  candidate text;
begin
  if input_id is null or church_name is null or btrim(church_name) = '' then
    raise exception 'A church ID and name are required' using errcode = '22023';
  end if;

  -- Serialize issuance, including the transition from digits to mixed codes.
  perform pg_advisory_xact_lock(1399750603, 1);

  return query
  select church.id, church.code
  from public.churches as church
  where church.id = input_id;
  if found then
    return;
  end if;

  for pool in 0..26 loop
    code_prefix := case when pool = 0 then '' else chr(65 + (first_letter + pool - 1) % 26) end;
    pool_size := case when pool = 0 then 1000000 else 100000 end;

    for attempt in 1..12 loop
      start_at := floor(random() * pool_size)::integer;
      candidate := code_prefix || lpad(start_at::text, 6 - length(code_prefix), '0');
      exit when candidate <> all (reserved) and not exists (
        select 1 from public.churches as church where church.code = candidate
      );
      candidate := null;
    end loop;

    if candidate is null then
      -- Check every slot from a random starting point before moving to the next pool.
      select proposed.code into candidate
      from generate_series(0, pool_size - 1) as offsets(step)
      cross join lateral (
        values (code_prefix || lpad(((start_at + offsets.step) % pool_size)::text, 6 - length(code_prefix), '0'))
      ) as proposed(code)
      where proposed.code <> all (reserved)
        and not exists (select 1 from public.churches as church where church.code = proposed.code)
      limit 1;
    end if;

    exit when candidate is not null;
  end loop;

  if candidate is null then
    raise exception 'Church code space exhausted' using errcode = '54000';
  end if;

  return query
  insert into public.churches as church (id, name, code)
  values (input_id, btrim(church_name), candidate)
  returning church.id, church.code;
end;
$$;

revoke all on function public.register_church(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.register_church(uuid, text) to service_role;

create function public.lookup_church_by_code(input_code text)
returns table (name text, code text)
language sql
stable
security definer
set search_path = ''
as $$
  select church.name, church.code
  from public.churches as church
  where church.code = upper(regexp_replace(input_code, '[[:space:]-]', '', 'g'));
$$;

revoke all on function public.lookup_church_by_code(text) from public, anon, authenticated, service_role;
grant execute on function public.lookup_church_by_code(text) to anon, authenticated, service_role;

commit;
