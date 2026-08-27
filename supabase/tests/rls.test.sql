begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select ok(
  exists (select 1 from storage.buckets where id = 'exam-pdfs' and public = false),
  'exam PDFs use a private Storage bucket'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.com', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'other@example.com', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'admin@example.com', '', now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.admin_users (user_id) values ('30000000-0000-0000-0000-000000000003');
insert into public.exams (id, year, month, title, status) values (999, 2028, 3, '관리자 초안 시험', 'draft');
insert into public.exam_subjects (exam_id, subject_id, status) values (999, 1, 'draft');

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
select is((select public.is_admin()), false, 'a regular user is not an admin');
select is((select count(*) from public.exam_subjects), 390::bigint, 'every seeded exam is linked to every subject');
select is(
  (
    select count(*)
    from (
      select es.id
      from public.exam_subjects es
      join public.subjects s on s.id = es.subject_id
      join public.answer_keys answer_key on answer_key.exam_subject_id = es.id
      group by es.id, s.question_count, s.area
      having count(answer_key.id) = s.question_count
        and sum(answer_key.points) = case when s.area in ('국어', '수학', '영어') then 100 else 50 end
    ) valid_answer_sets
  ),
  390::bigint,
  'every seeded answer set matches its subject question count and score rule total'
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
select throws_ok(
  $$insert into public.exams (year, month, title) values (2028, 4, '권한 없는 시험')$$,
  '42501',
  null,
  'a regular user cannot create an exam'
);

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
select is((select public.is_admin()), true, 'an admin membership is recognized');
select is((select count(*) from public.exams), 11::bigint, 'an admin can read draft and published exams');
select lives_ok(
  $$insert into public.exams (year, month, title) values (2028, 4, '관리자 추가 시험')$$,
  'an admin can create an exam'
);

reset role;
delete from auth.users where id = '10000000-0000-0000-0000-000000000001';

select is((select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000001'), 0::bigint, 'deleting an auth user deletes their profile');
select is((select count(*) from public.user_shortcuts where user_id = '10000000-0000-0000-0000-000000000001'), 0::bigint, 'deleting an auth user deletes their shortcuts');
select is((select count(*) from public.attempts where user_id = '10000000-0000-0000-0000-000000000001'), 0::bigint, 'deleting an auth user deletes their attempts');

select * from finish();
rollback;
