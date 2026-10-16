-- OPTIONAL DESIGN ONLY. UNEXECUTED / NOT VERIFIED LIVE.
-- Not imported by the app or run by npm, CI, or a migration runner.
-- Review in a disposable Supabase-compatible database before any future use.
begin;

create table public.margin_tasks (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 80 and id ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$'),
  title text not null check (char_length(btrim(title)) > 0 and char_length(title) <= 160),
  body text not null default '' check (char_length(body) <= 20000),
  tags text[] not null default '{}' check (cardinality(tags) <= 12 and array_position(tags, null) is null),
  archived boolean not null default false,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due date check (due between date '1900-01-01' and date '2200-12-31'),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table public.margin_notes (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 80 and id ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$'),
  title text not null check (char_length(btrim(title)) > 0 and char_length(title) <= 160),
  body text not null default '' check (char_length(body) <= 20000),
  tags text[] not null default '{}' check (cardinality(tags) <= 12 and array_position(tags, null) is null),
  archived boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table public.margin_task_notes (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id text not null,
  note_id text not null,
  primary key (owner_id, task_id, note_id),
  -- The SAME owner participates in BOTH foreign keys. A link cannot join
  -- Alice's task to Bob's note, even if both IDs are known to the caller.
  foreign key (owner_id, task_id) references public.margin_tasks(owner_id, id)
    on delete cascade on update restrict,
  foreign key (owner_id, note_id) references public.margin_notes(owner_id, id)
    on delete cascade on update restrict
);

create index margin_tasks_work_idx on public.margin_tasks(owner_id, archived, status, priority);
create index margin_tasks_due_idx on public.margin_tasks(owner_id, due) where due is not null;
create index margin_notes_work_idx on public.margin_notes(owner_id, archived, updated_at desc);
-- The link primary key indexes task lookups; this index supports note backlinks
-- and note-deletion foreign-key checks without scanning all links.
create index margin_task_notes_note_idx on public.margin_task_notes(owner_id, note_id);

alter table public.margin_tasks enable row level security;
alter table public.margin_tasks force row level security;
alter table public.margin_notes enable row level security;
alter table public.margin_notes force row level security;
alter table public.margin_task_notes enable row level security;
alter table public.margin_task_notes force row level security;

-- Do not inherit broad client grants, including TRUNCATE (which bypasses RLS).
revoke all on table public.margin_tasks, public.margin_notes, public.margin_task_notes
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.margin_tasks, public.margin_notes, public.margin_task_notes to authenticated;

-- PostgreSQL SELECT/DELETE accept USING; INSERT accepts WITH CHECK; UPDATE
-- requires BOTH to prevent changing an existing row's owner. Each operation
-- is explicit. auth.uid() = NULL never grants an unauthenticated caller access.
create policy margin_tasks_select on public.margin_tasks for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy margin_tasks_insert on public.margin_tasks for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy margin_tasks_update on public.margin_tasks for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy margin_tasks_delete on public.margin_tasks for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy margin_notes_select on public.margin_notes for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy margin_notes_insert on public.margin_notes for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy margin_notes_update on public.margin_notes for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy margin_notes_delete on public.margin_notes for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy margin_task_notes_select on public.margin_task_notes for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy margin_task_notes_insert on public.margin_task_notes for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy margin_task_notes_update on public.margin_task_notes for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy margin_task_notes_delete on public.margin_task_notes for delete to authenticated
  using ((select auth.uid()) = owner_id);

commit;
