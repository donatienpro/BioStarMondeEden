-- Bio Star Monde Éden : tables générées à partir de core/schema.js
-- Accès réservé au serveur (clé service_role) : RLS activée, aucune politique publique.

create table if not exists public.bsme_orders (
  id text primary key,
  username text not null,
  product_id text not null,
  amount double precision not null,
  memo text not null,
  payment_id text not null,
  txid text,
  status text not null check (status in ('approved', 'completed', 'cancelled')),
  created_at text not null
);
create unique index if not exists bsme_orders_payment_id_unique on public.bsme_orders (payment_id);
create index if not exists bsme_orders_username_idx on public.bsme_orders (username);
alter table public.bsme_orders enable row level security;

create table if not exists public.bsme_farms (
  id text primary key,
  owner text not null,
  name text not null,
  country text not null,
  region text not null,
  locality text,
  area_ha double precision,
  practices text,
  show_training boolean not null default false,
  created_at text not null,
  updated_at text not null
);
create unique index if not exists bsme_farms_owner_unique on public.bsme_farms (owner);
alter table public.bsme_farms enable row level security;

create table if not exists public.bsme_plots (
  id text primary key,
  farm_id text not null,
  owner text not null,
  name text not null,
  area_ha double precision,
  soil text,
  crop text,
  created_at text not null,
  updated_at text not null
);
create index if not exists bsme_plots_owner_idx on public.bsme_plots (owner);
alter table public.bsme_plots enable row level security;

create table if not exists public.bsme_lots (
  id text primary key,
  farm_id text not null,
  plot_id text,
  owner text not null,
  product text not null,
  quantity double precision,
  unit text,
  created_at text not null
);
create index if not exists bsme_lots_owner_idx on public.bsme_lots (owner);
alter table public.bsme_lots enable row level security;

create table if not exists public.bsme_lot_events (
  id text primary key,
  lot_id text not null,
  owner text not null,
  type text not null check (type in ('preparation', 'semis', 'intrant', 'traitement', 'irrigation', 'recolte', 'transformation', 'stockage', 'controle', 'vente', 'correction', 'autre')),
  date text not null,
  note text,
  created_at text not null
);
create index if not exists bsme_lot_events_lot_idx on public.bsme_lot_events (lot_id);
create index if not exists bsme_lot_events_owner_idx on public.bsme_lot_events (owner);
alter table public.bsme_lot_events enable row level security;

create table if not exists public.bsme_progress (
  id text primary key,
  owner text not null,
  course_id text not null,
  module_index double precision not null,
  status text not null check (status in ('done', 'pending', 'todo')),
  created_at text not null,
  updated_at text not null
);
create index if not exists bsme_progress_owner_idx on public.bsme_progress (owner);
create index if not exists bsme_progress_status_idx on public.bsme_progress (status);
alter table public.bsme_progress enable row level security;

create table if not exists public.bsme_attestations (
  id text primary key,
  owner text not null,
  course_id text not null,
  course_title text not null,
  hash text not null,
  status text not null check (status in ('valid', 'revoked')),
  created_at text not null
);
create index if not exists bsme_attestations_owner_idx on public.bsme_attestations (owner);
create unique index if not exists bsme_attestations_owner_course_unique on public.bsme_attestations (owner, course_id);
alter table public.bsme_attestations enable row level security;

create table if not exists public.bsme_advice (
  id text primary key,
  owner text not null,
  crop text not null,
  symptom text,
  cause text,
  message text,
  status text not null check (status in ('open', 'answered')),
  answer text,
  answered_at text,
  created_at text not null
);
create index if not exists bsme_advice_owner_idx on public.bsme_advice (owner);
create index if not exists bsme_advice_status_idx on public.bsme_advice (status);
alter table public.bsme_advice enable row level security;

create table if not exists public.bsme_messages (
  id text primary key,
  owner text not null,
  message text not null,
  created_at text not null
);
create index if not exists bsme_messages_owner_idx on public.bsme_messages (owner);
alter table public.bsme_messages enable row level security;


