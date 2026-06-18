create table if not exists replies (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references pins(id) on delete cascade,
  author_name text not null default 'Anônimo',
  body text not null,
  created_at timestamptz not null default now()
);

alter table replies enable row level security;
create policy "public read" on replies for select using (true);
create policy "public insert" on replies for insert with check (true);
