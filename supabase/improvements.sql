-- Foodie Place production improvements
-- Run once in Supabase Dashboard -> SQL Editor -> New query.
alter table public.menu_items
  add column if not exists deal_items jsonb not null default '[]'::jsonb;

alter table public.orders
  add column if not exists notes text,
  add column if not exists subtotal numeric not null default 0,
  add column if not exists delivery_fee numeric not null default 0,
  add column if not exists tracking_token text;

create unique index if not exists orders_tracking_token_unique
  on public.orders (tracking_token)
  where tracking_token is not null;

alter table public.restaurant_settings
  add column if not exists whatsapp_phone text not null default '',
  add column if not exists delivery_fee numeric not null default 0,
  add column if not exists minimum_order numeric not null default 0,
  add column if not exists estimated_delivery text not null default '30–45 minutes',
  add column if not exists is_open boolean not null default true;

-- Existing historical orders do not have private tracking tokens.
-- New orders receive a token from the server.
