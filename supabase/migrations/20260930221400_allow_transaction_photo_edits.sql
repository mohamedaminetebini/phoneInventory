create or replace function public.validate_phone_transaction_photo_paths()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id_front_path is not null and new.id_front_path !~ ('^' || new.user_id::text || '/' || new.id::text || '/id-front(-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?[.]jpg$'))
    or (new.id_back_path is not null and new.id_back_path !~ ('^' || new.user_id::text || '/' || new.id::text || '/id-back(-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?[.]jpg$')) then
    raise exception using errcode = '23514', message = 'invalid transaction photo path';
  end if;

  if cardinality(new.phone_photos) > 5
    or cardinality(array_remove(new.phone_photos, null)) <> cardinality(new.phone_photos)
    or exists (
      select 1
      from pg_catalog.unnest(new.phone_photos) as photo(path)
      where photo.path !~ ('^' || new.user_id::text || '/' || new.id::text || '/phone-[1-5](-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?[.]jpg$')
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

drop policy if exists "Users can upload their own transaction photos" on storage.objects;
create policy "Users can upload their own transaction photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'transaction-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ (
      '^' || (select auth.uid())::text || '/[0-9a-f-]{36}/'
      || '(phone-[1-5](-[0-9a-f-]{36})?|id-front(-[0-9a-f-]{36})?|id-back(-[0-9a-f-]{36})?)[.]jpg$'
    )
  );
