begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.com', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'other@example.com', '', now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.user_shortcuts (user_id, subject_id) values
  ('10000000-0000-0000-0000-000000000001', 1),
  ('20000000-0000-0000-0000-000000000002', 1);

insert into public.attempts (user_id, exam_subject_id, answers) values
  ('10000000-0000-0000-0000-000000000001', (select id from public.exam_subjects order by id limit 1), '{"1": 2}'),
  ('20000000-0000-0000-0000-000000000002', (select id from public.exam_subjects order by id limit 1), '{"1": 3}');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select is((select count(*) from public.profiles), 1::bigint, 'only the signed-in profile is visible');
select is((select count(*) from public.user_shortcuts), 1::bigint, 'only owned shortcuts are visible');
select is((select count(*) from public.attempts), 1::bigint, 'only owned attempts are visible');
select is((select count(*) from public.subjects), 39::bigint, 'reference subjects are readable');
select is((select count(*) from public.exams), 10::bigint, 'reference exams are readable');
select is((select count(*) from public.exam_subjects), 390::bigint, 'every seeded exam is linked to every subject');
select is(
  (
    select count(*)
    from (
      select es.id
      from public.exam_subjects es
      join public.subjects s on s.id = es.subject_id
      join public.answer_keys answer_key on answer_key.exam_subject_id = es.id
      group by es.id, s.question_count
      having count(answer_key.id) = s.question_count and sum(answer_key.points) = 100
    ) valid_answer_sets
  ),
  390::bigint,
  'every seeded answer set matches its subject question count and totals 100 points'
);

select lives_ok(
  $$insert into public.user_shortcuts (user_id, subject_id) values ('10000000-0000-0000-0000-000000000001', 2)$$,
  'a user can create an owned shortcut'
);
select throws_ok(
  $$insert into public.user_shortcuts (user_id, subject_id) values ('20000000-0000-0000-0000-000000000002', 2)$$,
  '42501',
  null,
  'a user cannot create another user shortcut'
);

select * from finish();
rollback;
