create table public.phone_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direction text not null check (direction in ('buy', 'sell')),
  model_id text not null,
  phone_model text not null,
  phone_color text not null,
  amount numeric(12, 3) not null check (amount > 0 and amount <= 10000000),
  currency text not null check (currency in ('TND', 'EUR', 'USD')),
  date date not null,
  phone_photos text[] not null default '{}'::text[],
  id_front_path text not null,
  id_back_path text not null,
  notes text not null default '' check (char_length(notes) <= 3000),
  created_at timestamptz not null default now()
);

create index phone_transactions_user_date_idx
  on public.phone_transactions (user_id, date desc, created_at desc);

alter table public.phone_transactions enable row level security;
alter table public.phone_transactions force row level security;

revoke all on table public.phone_transactions from anon, authenticated;
grant select, delete on table public.phone_transactions to authenticated;
grant select, insert on table public.phone_transactions to service_role;

create policy "Users can read their own phone transactions"
  on public.phone_transactions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete their own phone transactions"
  on public.phone_transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.validate_phone_transaction_photo_paths()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id_front_path <> new.user_id::text || '/' || new.id::text || '/id-front.jpg'
    or new.id_back_path <> new.user_id::text || '/' || new.id::text || '/id-back.jpg' then
    raise exception using errcode = '23514', message = 'invalid transaction photo path';
  end if;

  if cardinality(new.phone_photos) > 5
    or cardinality(array_remove(new.phone_photos, null)) <> cardinality(new.phone_photos)
    or exists (
      select 1
      from pg_catalog.unnest(new.phone_photos) as photo(path)
      where photo.path !~ ('^' || new.user_id::text || '/' || new.id::text || '/phone-[1-5][.]jpg$')
    )
    or cardinality(new.phone_photos) <> (
      select count(distinct photo.path)
      from pg_catalog.unnest(new.phone_photos) as photo(path)
    ) then
    raise exception using errcode = '23514', message = 'invalid transaction photo path';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_phone_transaction_photo_paths() from public, anon, authenticated;

create trigger phone_transactions_validate_photo_paths
  before insert or update of user_id, id, phone_photos, id_front_path, id_back_path
  on public.phone_transactions
  for each row execute function public.validate_phone_transaction_photo_paths();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('transaction-photos', 'transaction-photos', false, 5242880, array['image/jpeg']::text[])
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own transaction photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'transaction-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload their own transaction photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'transaction-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}/(phone-[1-5]|id-front|id-back)[.]jpg$')
  );

create policy "Users can delete their own transaction photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'transaction-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
