alter table public.phone_transactions
  add column imei text,
  add column serial_number text,
  alter column id_front_path drop not null,
  alter column id_back_path drop not null,
  alter column date set default current_date,
  add constraint phone_transactions_imei_format_check
    check (imei is null or imei ~ '^[0-9]{15}$'),
  add constraint phone_transactions_serial_number_length_check
    check (serial_number is null or char_length(serial_number) between 1 and 50);

create or replace function public.validate_phone_transaction_photo_paths()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id_front_path is not null and new.id_front_path <> new.user_id::text || '/' || new.id::text || '/id-front.jpg')
    or (new.id_back_path is not null and new.id_back_path <> new.user_id::text || '/' || new.id::text || '/id-back.jpg') then
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
