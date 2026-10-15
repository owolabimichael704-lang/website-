create extension if not exists pgcrypto;

create table if not exists public.admin_users (
	user_id uuid primary key references auth.users (id) on delete cascade,
	created_at timestamptz not null default now()
);

create table if not exists public.listings (
	id uuid primary key default gen_random_uuid(),
	name text not null check (char_length(name) between 2 and 90),
	platform text not null check (platform in ('PlayStation', 'Xbox', 'Mobile', 'PC')),
	rating integer not null check (rating between 1 and 9999),
	price numeric(12, 2) not null check (price >= 0),
	currency text not null default 'USD' check (currency in ('USD', 'NGN', 'GBP', 'EUR')),
	tag text not null default 'Available',
	players text[] not null default '{}',
	description text not null default '',
	images text[] not null default '{}',
	record text not null default '',
	condition text not null default '',
	whatsapp_number text not null check (whatsapp_number ~ '^[0-9]{8,15}$'),
	status text not null default 'draft' check (status in ('draft', 'active', 'sold')),
	sort_order integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint active_listings_have_images check (status <> 'active' or cardinality(images) > 0)
);

create or replace function public.is_touchline_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1 from public.admin_users where user_id = (select auth.uid())
	);
$$;

revoke all on function public.is_touchline_admin() from public;
grant execute on function public.is_touchline_admin() to anon, authenticated;

grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
alter table public.admin_users enable row level security;
alter table public.listings enable row level security;

drop policy if exists "Published listings are public" on public.listings;
create policy "Published listings are public"
	on public.listings for select
	using (status = 'active' or public.is_touchline_admin());

drop policy if exists "Admins insert listings" on public.listings;
create policy "Admins insert listings"
	on public.listings for insert to authenticated
	with check (public.is_touchline_admin());

drop policy if exists "Admins update listings" on public.listings;
create policy "Admins update listings"
	on public.listings for update to authenticated
	using (public.is_touchline_admin())
	with check (public.is_touchline_admin());

drop policy if exists "Admins delete listings" on public.listings;
create policy "Admins delete listings"
	on public.listings for delete to authenticated
	using (public.is_touchline_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Listing images are public" on storage.objects;
create policy "Listing images are public"
	on storage.objects for select
	using (bucket_id = 'listing-images');

drop policy if exists "Admins upload listing images" on storage.objects;
create policy "Admins upload listing images"
	on storage.objects for insert to authenticated
	with check (bucket_id = 'listing-images' and public.is_touchline_admin());

drop policy if exists "Admins update listing images" on storage.objects;
create policy "Admins update listing images"
	on storage.objects for update to authenticated
	using (bucket_id = 'listing-images' and public.is_touchline_admin())
	with check (bucket_id = 'listing-images' and public.is_touchline_admin());

drop policy if exists "Admins delete listing images" on storage.objects;
create policy "Admins delete listing images"
	on storage.objects for delete to authenticated
	using (bucket_id = 'listing-images' and public.is_touchline_admin());

do $$
begin
	if not exists (
		select 1 from pg_publication_tables
		where pubname = 'supabase_realtime'
		  and schemaname = 'public'
		  and tablename = 'listings'
	) then
		alter publication supabase_realtime add table public.listings;
	end if;
end;
$$;