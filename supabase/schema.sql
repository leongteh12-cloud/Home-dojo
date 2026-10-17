-- Home Dojo Monsters: database setup.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- Safe to run more than once.


-- A family is one household. Members are the grown-ups who use the app.
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  family_id uuid not null references public.families on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('admin', 'carer')),
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Settings: children, monsters, behaviours, treats, goals. One JSON document per family.
create table if not exists public.family_config (
  family_id uuid primary key references public.families on delete cascade,
  config jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- Every point earned, item bought, treat spent and goal given.
create table if not exists public.awards (
  id text not null,
  family_id uuid not null references public.families on delete cascade,
  kid text not null,
  kind text not null check (kind in ('earn', 'buy', 'spend', 'given')),
  label text,
  icon text,
  bid text,
  item text,
  mid text,
  pts integer not null default 0,
  at bigint not null,
  by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (family_id, id)
);
create index if not exists awards_family_at on public.awards (family_id, at);
-- Notes from grown-ups to a child's mailbox are kept with the awards (kind 'note').
alter table public.awards drop constraint if exists awards_kind_check;
alter table public.awards add constraint awards_kind_check check (kind in ('earn', 'buy', 'spend', 'given', 'note'));

create table if not exists public.invites (
  code text primary key,
  family_id uuid not null references public.families on delete cascade,
  role text not null default 'carer' check (role in ('admin', 'carer')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid,
  used_at timestamptz
);

-- Helpers used by the access rules.
create or replace function public.is_member(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where family_id = f and user_id = auth.uid());
$$;

create or replace function public.is_admin(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where family_id = f and user_id = auth.uid() and role = 'admin');
$$;

-- Access rules: only members of a family can see or change its data.
alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.family_config enable row level security;
alter table public.awards enable row level security;
alter table public.invites enable row level security;

drop policy if exists "members read family" on public.families;
create policy "members read family" on public.families for select using (public.is_member(id));
drop policy if exists "admins rename family" on public.families;
create policy "admins rename family" on public.families for update using (public.is_admin(id));

drop policy if exists "members see members" on public.members;
create policy "members see members" on public.members for select using (public.is_member(family_id));
drop policy if exists "admins manage members" on public.members;
create policy "admins manage members" on public.members for update using (public.is_admin(family_id));
drop policy if exists "admins remove or self leave" on public.members;
create policy "admins remove or self leave" on public.members for delete using (public.is_admin(family_id) or user_id = auth.uid());

drop policy if exists "members read config" on public.family_config;
create policy "members read config" on public.family_config for select using (public.is_member(family_id));
drop policy if exists "admins write config" on public.family_config;
create policy "admins write config" on public.family_config for insert with check (public.is_admin(family_id));
drop policy if exists "admins update config" on public.family_config;
create policy "admins update config" on public.family_config for update using (public.is_admin(family_id));
-- Carers may change a monster's look and outfit; the app sends that through set_monster() below.

drop policy if exists "members read awards" on public.awards;
create policy "members read awards" on public.awards for select using (public.is_member(family_id));
drop policy if exists "members add awards" on public.awards;
create policy "members add awards" on public.awards for insert with check (
  public.is_member(family_id) and by = auth.uid()
  and (kind in ('earn', 'buy', 'note') or public.is_admin(family_id))
);
drop policy if exists "admins delete or quick undo" on public.awards;
create policy "admins delete or quick undo" on public.awards for delete using (
  public.is_admin(family_id) or (by = auth.uid() and created_at > now() - interval '15 minutes')
);

drop policy if exists "admins read invites" on public.invites;
create policy "admins read invites" on public.invites for select using (public.is_admin(family_id));
drop policy if exists "admins create invites" on public.invites;
create policy "admins create invites" on public.invites for insert with check (public.is_admin(family_id));
drop policy if exists "admins delete invites" on public.invites;
create policy "admins delete invites" on public.invites for delete using (public.is_admin(family_id));

-- Start a new family; the caller becomes its first admin.
create or replace function public.create_family(p_name text, p_display text) returns uuid
language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into families (name) values (coalesce(nullif(trim(p_name), ''), 'Our family')) returning id into f;
  insert into members (family_id, user_id, role, display_name) values (f, auth.uid(), 'admin', coalesce(p_display, ''));
  return f;
end $$;

-- Join a family with an invite code.
create or replace function public.join_family(p_code text, p_display text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv invites;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into inv from invites where code = upper(trim(p_code)) for update;
  if not found or inv.used_by is not null or inv.expires_at < now() then
    raise exception 'That invite code is not valid. Ask for a new one.';
  end if;
  insert into members (family_id, user_id, role, display_name)
    values (inv.family_id, auth.uid(), inv.role, coalesce(p_display, ''))
    on conflict (family_id, user_id) do update set role = excluded.role;
  update invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.family_id;
end $$;

-- Let any member dress a monster (only the "equip" part of one child's settings).
create or replace function public.set_equip(p_family uuid, p_kid text, p_equip jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; i int;
begin
  if not public.is_member(p_family) then raise exception 'Not a member of this family'; end if;
  select config into cfg from family_config where family_id = p_family for update;
  if cfg is null then return; end if;
  for i in 0 .. jsonb_array_length(cfg->'kids') - 1 loop
    if cfg->'kids'->i->>'id' = p_kid then
      cfg := jsonb_set(cfg, array['kids', i::text, 'equip'], p_equip);
    end if;
  end loop;
  update family_config set config = cfg, updated_at = now(), updated_by = auth.uid() where family_id = p_family;
end $$;

-- Let any member change a monster: its look, outfit, name, trophy shelf, hatched eggs, game scores, island and yard (nothing else).
create or replace function public.set_monster(p_family uuid, p_kid text, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; i int; allowed jsonb;
begin
  if not public.is_member(p_family) then raise exception 'Not a member of this family'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into allowed
    from jsonb_each(p_patch) where key in ('look', 'equip', 'monsterName', 'shelf', 'eggs', 'plays', 'best', 'island', 'yard');
  select config into cfg from family_config where family_id = p_family for update;
  if cfg is null then return; end if;
  for i in 0 .. jsonb_array_length(cfg->'kids') - 1 loop
    if cfg->'kids'->i->>'id' = p_kid then
      cfg := jsonb_set(cfg, array['kids', i::text], (cfg->'kids'->i) || allowed);
    end if;
  end loop;
  update family_config set config = cfg, updated_at = now(), updated_by = auth.uid() where family_id = p_family;
end $$;

-- Anyone in the family can build on the shared family island (stored as config.familyIsland).
create or replace function public.set_family_island(p_family uuid, p_island jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_family) then raise exception 'Not a member of this family'; end if;
  update family_config set config = jsonb_set(config, '{familyIsland}', p_island, true), updated_at = now(), updated_by = auth.uid()
   where family_id = p_family;
end $$;

-- Restore history from a backup file (parents only). Existing entries are kept.
create or replace function public.import_awards(p_family uuid, p_rows jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin(p_family) then raise exception 'Only parents can restore backups'; end if;
  insert into awards (id, family_id, kid, kind, label, icon, bid, item, mid, pts, at, by)
  select r->>'id', p_family, r->>'kid', r->>'kind', r->>'label', r->>'icon', r->>'bid', r->>'item', r->>'mid',
         coalesce((r->>'pts')::int, 0), (r->>'at')::bigint, coalesce(nullif(r->>'by', '')::uuid, auth.uid())
  from jsonb_array_elements(p_rows) r
  where r->>'id' is not null and r->>'kind' in ('earn', 'buy', 'spend', 'given', 'note')
  on conflict (family_id, id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.import_awards(uuid, jsonb) to authenticated;
grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;
grant execute on function public.set_equip(uuid, text, jsonb) to authenticated;
grant execute on function public.set_monster(uuid, text, jsonb) to authenticated;
grant execute on function public.set_family_island(uuid, jsonb) to authenticated;

-- Live updates between phones.
alter table public.awards replica identity full;
alter table public.family_config replica identity full;
do $$ begin
  begin alter publication supabase_realtime add table public.awards; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.family_config; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.members; exception when duplicate_object then null; end;
end $$;
