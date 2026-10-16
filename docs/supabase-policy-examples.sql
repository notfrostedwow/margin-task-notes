-- UNEXECUTED / NOT VERIFIED LIVE. Documentation examples, NOT passing tests.
-- Requires the reviewed schema, Supabase auth functions/roles, pgTAP in
-- extensions, and a disposable database. Run only under future authorization.
-- Bootstrap uses a privileged SQL test session; assertions switch to actual
-- client roles. Synthetic auth fixtures roll back, cannot log in, and use no keys.
begin;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
insert into public.margin_tasks(owner_id, id, title) values
  ('11111111-1111-4111-8111-111111111111', 'task-a', 'Synthetic task A'),
  ('22222222-2222-4222-8222-222222222222', 'task-b', 'Synthetic task B');
insert into public.margin_notes(owner_id, id, title) values
  ('11111111-1111-4111-8111-111111111111', 'note-a', 'Synthetic note A'),
  ('22222222-2222-4222-8222-222222222222', 'note-b', 'Synthetic note B');
insert into public.margin_task_notes(owner_id, task_id, note_id) values
  ('11111111-1111-4111-8111-111111111111', 'task-a', 'note-a'),
  ('22222222-2222-4222-8222-222222222222', 'task-b', 'note-b');

-- Check configuration before switching away from the bootstrap role.
select ok(c.relrowsecurity and c.relforcerowsecurity, c.relname || ': RLS enabled and forced')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('margin_tasks', 'margin_notes', 'margin_task_notes');
select is(count(*)::integer, 12, 'four explicit policies per table')
from pg_policies where schemaname = 'public'
and tablename in ('margin_tasks', 'margin_notes', 'margin_task_notes');
select ok(not has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE'), t || ': no client truncate')
from unnest(array['margin_tasks', 'margin_notes', 'margin_task_notes']) as names(t);

-- Alice: SELECT checks actual rows, not just absence of an exception.
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is(auth.uid(), '11111111-1111-4111-8111-111111111111'::uuid, 'Alice identity is active');
select is((select count(*) from public.margin_tasks), 1::bigint, 'Alice sees only her task');
select is((select count(*) from public.margin_notes), 1::bigint, 'Alice sees only her note');
select is((select count(*) from public.margin_task_notes), 1::bigint, 'Alice sees only her link');
select is((select count(*) from public.margin_tasks where id = 'task-b'), 0::bigint, 'Bob task hidden');
select is((select count(*) from public.margin_notes where id = 'note-b'), 0::bigint, 'Bob note hidden');
select is((select count(*) from public.margin_task_notes where task_id = 'task-b'), 0::bigint, 'Bob link hidden');

-- Own INSERT + UPDATE: mutate directly, then assert actual rows and values.
-- pgTAP results_eq uses cursors, so its query arguments below stay SELECT-only.
insert into public.margin_tasks(id, title) values ('task-new', 'New');
select results_eq($$select id from public.margin_tasks where id = 'task-new'$$,
  array['task-new'], 'Alice can insert a task with her default owner');
insert into public.margin_notes(id, title) values ('note-new', 'New');
select results_eq($$select id from public.margin_notes where id = 'note-new'$$,
  array['note-new'], 'Alice can insert a note');
insert into public.margin_task_notes(task_id, note_id) values ('task-new', 'note-new');
select results_eq($$select task_id from public.margin_task_notes where task_id = 'task-new'$$,
  array['task-new'], 'Alice can link her own records');
update public.margin_tasks set title = 'Edited' where id = 'task-new';
select results_eq($$select title from public.margin_tasks where id = 'task-new'$$,
  array['Edited'], 'Alice can edit her task');
update public.margin_notes set body = 'Edited body' where id = 'note-new';
select results_eq($$select body from public.margin_notes where id = 'note-new'$$,
  array['Edited body'], 'Alice can edit her note');
update public.margin_task_notes set note_id = 'note-a' where task_id = 'task-new';
select results_eq($$select note_id from public.margin_task_notes where task_id = 'task-new'$$,
  array['note-a'], 'Alice can retarget a link to her own note');

-- INSERT WITH CHECK denies spoofing Bob's owner on EVERY table.
select throws_ok($$insert into public.margin_tasks(owner_id, id, title) values ('22222222-2222-4222-8222-222222222222', 'spoof', 'Spoof')$$,
  '42501', null, 'cannot insert task as Bob');
select throws_ok($$insert into public.margin_notes(owner_id, id, title) values ('22222222-2222-4222-8222-222222222222', 'spoof', 'Spoof')$$,
  '42501', null, 'cannot insert note as Bob');
select throws_ok($$insert into public.margin_task_notes(owner_id, task_id, note_id) values ('22222222-2222-4222-8222-222222222222', 'task-b', 'note-b')$$,
  '42501', null, 'cannot insert link as Bob');

-- UPDATE WITH CHECK denies moving an owned row into another tenant.
select throws_ok($$update public.margin_tasks set owner_id = '22222222-2222-4222-8222-222222222222' where id = 'task-new'$$,
  '42501', null, 'cannot transfer task ownership');
select throws_ok($$update public.margin_notes set owner_id = '22222222-2222-4222-8222-222222222222' where id = 'note-new'$$,
  '42501', null, 'cannot transfer note ownership');
select throws_ok($$update public.margin_task_notes set owner_id = '22222222-2222-4222-8222-222222222222' where task_id = 'task-new'$$,
  '42501', null, 'cannot transfer link ownership');

-- USING hides other tenants from UPDATE and DELETE. Assert ROW_COUNT = 0;
-- an unexpected exception also fails lives_ok instead of masquerading as denial.
select lives_ok($$do $block$ declare affected bigint; begin
  update public.margin_tasks set title = 'Intrusion' where id = 'task-b';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Changed another tenant task'; end if;
end $block$;$$, 'cannot update Bob task');
select lives_ok($$do $block$ declare affected bigint; begin
  update public.margin_notes set body = 'Intrusion' where id = 'note-b';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Changed another tenant note'; end if;
end $block$;$$, 'cannot update Bob note');
select lives_ok($$do $block$ declare affected bigint; begin
  update public.margin_task_notes set note_id = 'note-a' where task_id = 'task-b';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Changed another tenant link'; end if;
end $block$;$$, 'cannot update Bob link');
select lives_ok($$do $block$ declare affected bigint; begin
  delete from public.margin_tasks where id = 'task-b';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Deleted another tenant task'; end if;
end $block$;$$, 'cannot delete Bob task');
select lives_ok($$do $block$ declare affected bigint; begin
  delete from public.margin_notes where id = 'note-b';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Deleted another tenant note'; end if;
end $block$;$$, 'cannot delete Bob note');
select lives_ok($$do $block$ declare affected bigint; begin
  delete from public.margin_task_notes where task_id = 'task-b';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Deleted another tenant link'; end if;
end $block$;$$, 'cannot delete Bob link');

-- A caller-owned link still cannot reference another owner's record.
-- These fail composite foreign keys, not merely the owner RLS predicate.
select throws_ok($$insert into public.margin_task_notes(task_id, note_id) values ('task-a', 'note-b')$$,
  '23503', null, 'cross-owner note rejected');
select throws_ok($$insert into public.margin_task_notes(task_id, note_id) values ('task-b', 'note-a')$$,
  '23503', null, 'cross-owner task rejected');
select throws_ok($$update public.margin_task_notes set note_id = 'note-b' where task_id = 'task-a'$$,
  '23503', null, 'link update cannot cross owners');
select throws_ok($$insert into public.margin_task_notes(task_id, note_id) values ('task-a', 'missing-note')$$,
  '23503', null, 'dangling note rejected');

-- Own DELETE works for all three tables. Cascades preserve other tenants.
delete from public.margin_task_notes where task_id = 'task-new';
select is((select count(*) from public.margin_task_notes where task_id = 'task-new'), 0::bigint, 'Alice can delete her link');
delete from public.margin_tasks where id = 'task-new';
select is((select count(*) from public.margin_tasks where id = 'task-new'), 0::bigint, 'Alice can delete her task');
delete from public.margin_notes where id = 'note-new';
select is((select count(*) from public.margin_notes where id = 'note-new'), 0::bigint, 'Alice can delete her note');
delete from public.margin_notes where id = 'note-a';
select is((select count(*) from public.margin_notes where id = 'note-a'), 0::bigint, 'deleting original note succeeds');
select is((select count(*) from public.margin_task_notes), 0::bigint, 'note deletion cascades Alice links');

-- Bob's data is intact, and Bob cannot see Alice's remaining task.
reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.margin_tasks), 1::bigint, 'Bob task survives');
select is((select count(*) from public.margin_notes), 1::bigint, 'Bob note survives');
select is((select count(*) from public.margin_task_notes), 1::bigint, 'Bob link survives');
select is((select count(*) from public.margin_tasks where id = 'task-a'), 0::bigint, 'Alice task hidden from Bob');

-- Authenticated role without a subject fails closed.
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.margin_tasks), 0::bigint, 'null uid sees no tasks');
select is((select count(*) from public.margin_notes), 0::bigint, 'null uid sees no notes');
select is((select count(*) from public.margin_task_notes), 0::bigint, 'null uid sees no links');

-- Anonymous users have NO CRUD grants, regardless of policies.
reset role;
set local role anon;
select throws_ok($$select * from public.margin_tasks$$, '42501', null, 'anon task SELECT denied');
select throws_ok($$insert into public.margin_tasks(id, title) values ('anon', 'Anon')$$, '42501', null, 'anon task INSERT denied');
select throws_ok($$update public.margin_tasks set title = 'Anon'$$, '42501', null, 'anon task UPDATE denied');
select throws_ok($$delete from public.margin_tasks$$, '42501', null, 'anon task DELETE denied');
select throws_ok($$select * from public.margin_notes$$, '42501', null, 'anon note SELECT denied');
select throws_ok($$insert into public.margin_notes(id, title) values ('anon', 'Anon')$$, '42501', null, 'anon note INSERT denied');
select throws_ok($$update public.margin_notes set title = 'Anon'$$, '42501', null, 'anon note UPDATE denied');
select throws_ok($$delete from public.margin_notes$$, '42501', null, 'anon note DELETE denied');
select throws_ok($$select * from public.margin_task_notes$$, '42501', null, 'anon link SELECT denied');
select throws_ok($$insert into public.margin_task_notes(task_id, note_id) values ('task-b', 'note-b')$$, '42501', null, 'anon link INSERT denied');
select throws_ok($$update public.margin_task_notes set note_id = 'note-b'$$, '42501', null, 'anon link UPDATE denied');
select throws_ok($$delete from public.margin_task_notes$$, '42501', null, 'anon link DELETE denied');

reset role;
select * from finish();
rollback;
