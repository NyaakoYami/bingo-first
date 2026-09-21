-- Chạy toàn bộ tệp này trong Supabase SQL Editor trước khi deploy.
create table if not exists rooms (
  code text primary key,
  current_number integer,
  called_numbers integer[] not null default '{}',
  round integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists winners (
  id bigint generated always as identity primary key,
  room_code text not null references rooms(code) on delete cascade,
  player_name text not null check (char_length(player_name) between 1 and 24),
  claimed_at timestamptz not null default now(),
  round integer not null default 1,
  completed_lines integer not null default 1
);
create table if not exists chat_messages (id bigint generated always as identity primary key, room_code text not null references rooms(code) on delete cascade, player_name text not null, message text not null check (char_length(message) between 1 and 240), kind text not null default 'chat', round integer not null default 1, created_at timestamptz not null default now());

alter table rooms enable row level security;
alter table winners enable row level security;
alter table chat_messages enable row level security;
create policy "public room create" on rooms for insert with check (true);
create policy "public room read" on rooms for select using (true);
create policy "public room update" on rooms for update using (true) with check (true);
create policy "public winners read" on winners for select using (true);
create policy "public winners add" on winners for insert with check (true);
create policy "public winners reset" on winners for delete using (true);
create policy "public chat read" on chat_messages for select using (true);
create policy "public chat add" on chat_messages for insert with check (true);

insert into rooms (code) values ('DEMO-2026') on conflict (code) do nothing;

alter publication supabase_realtime add table rooms, winners, chat_messages;
