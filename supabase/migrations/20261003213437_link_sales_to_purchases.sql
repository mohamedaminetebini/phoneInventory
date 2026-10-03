alter table public.phone_transactions
  add column sold_from_transaction_id uuid;

alter table public.phone_transactions
  add constraint phone_transactions_user_id_id_key unique (user_id, id);

alter table public.phone_transactions
  add constraint phone_transactions_sale_source_same_user_fkey
    foreign key (user_id, sold_from_transaction_id)
    references public.phone_transactions (user_id, id)
    on delete restrict;

alter table public.phone_transactions
  add constraint phone_transactions_sale_source_direction_check
    check (sold_from_transaction_id is null or direction = 'sell');

create unique index phone_transactions_single_sale_per_purchase_idx
  on public.phone_transactions (sold_from_transaction_id)
  where sold_from_transaction_id is not null;

create index phone_transactions_inventory_lookup_idx
  on public.phone_transactions (user_id, model_id, phone_color);

create or replace function public.enforce_phone_sale_links()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  purchase public.phone_transactions%rowtype;
  units_in_stock bigint;
begin
  if tg_op = 'UPDATE' then
    if new.direction is distinct from old.direction then
      raise exception using errcode = '23514', message = 'transaction direction cannot be changed';
    end if;

    if new.sold_from_transaction_id is distinct from old.sold_from_transaction_id then
      raise exception using errcode = '23514', message = 'sale source cannot be changed';
    end if;

    if old.direction = 'buy'
      and (new.model_id, new.phone_color, new.imei, new.serial_number)
        is distinct from (old.model_id, old.phone_color, old.imei, old.serial_number)
      and exists (
        select 1
        from public.phone_transactions as sale
        where sale.sold_from_transaction_id = old.id
          and sale.user_id = old.user_id
      ) then
      raise exception using errcode = '23514', message = 'sold phone identity cannot be changed';
    end if;
  end if;

  if new.direction = 'buy' then
    if new.sold_from_transaction_id is not null then
      raise exception using errcode = '23514', message = 'purchase cannot reference a sale source';
    end if;
    return new;
  end if;

  if new.sold_from_transaction_id is null then
    if tg_op = 'INSERT' then
      raise exception using errcode = '23514', message = 'new sales must link to a purchase';
    end if;

    if old.direction <> 'sell' or old.sold_from_transaction_id is not null then
      raise exception using errcode = '23514', message = 'new sales must link to a purchase';
    end if;

    -- Keep older unlinked sales editable for historical corrections.
    return new;
  end if;

  select source.*
  into purchase
  from public.phone_transactions as source
  where source.id = new.sold_from_transaction_id
    and source.user_id = new.user_id
  for update;

  if not found then
    raise exception using errcode = '23503', message = 'sale source must be a purchase owned by the same user';
  end if;

  if purchase.direction <> 'buy' then
    raise exception using errcode = '23503', message = 'sale source must be a purchase owned by the same user';
  end if;

  if (new.model_id, new.phone_color, new.imei, new.serial_number)
    is distinct from (purchase.model_id, purchase.phone_color, purchase.imei, purchase.serial_number) then
    raise exception using errcode = '23514', message = 'sale identity must match its purchase';
  end if;

  if tg_op = 'INSERT' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.user_id::text || ':' || new.model_id || ':' || new.phone_color, 0)
    );

    select coalesce(sum(case when stock.direction = 'buy' then 1 else -1 end), 0)
    into units_in_stock
    from public.phone_transactions as stock
    where stock.user_id = new.user_id
      and stock.model_id = new.model_id
      and stock.phone_color = new.phone_color;

    if units_in_stock < 1 then
      raise exception using errcode = '23514', message = 'no units remain in stock';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_phone_sale_links() from public, anon, authenticated;

create trigger phone_transactions_enforce_sale_links
  before insert or update of direction, sold_from_transaction_id, user_id, model_id, phone_color, imei, serial_number
  on public.phone_transactions
  for each row execute function public.enforce_phone_sale_links();
