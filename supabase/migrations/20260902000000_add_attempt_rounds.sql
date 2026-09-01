alter table public.attempts
  add column round_number integer not null default 1 check (round_number >= 1),
  add column is_current boolean not null default true;

alter table public.attempts
  drop constraint if exists attempts_user_id_exam_subject_id_key;

alter table public.attempts
  add constraint attempts_user_id_exam_subject_id_round_number_key unique (user_id, exam_subject_id, round_number);

create unique index attempts_one_current_round_idx
  on public.attempts (user_id, exam_subject_id)
  where is_current;

create index attempts_current_user_updated_idx
  on public.attempts (user_id, updated_at desc)
  where is_current;

create or replace function public.start_next_attempt_round(p_exam_subject_id bigint)
returns public.attempts
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_round integer;
  created_attempt public.attempts;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  update public.attempts
  set is_current = false
  where user_id = auth.uid()
    and exam_subject_id = p_exam_subject_id
    and is_current
    and status = 'done'
  returning round_number + 1 into next_round;

  if next_round is null then
    raise exception 'Only a completed current round can start the next round' using errcode = 'P0001';
  end if;

  insert into public.attempts (user_id, exam_subject_id, round_number, is_current, answers, status)
  values (auth.uid(), p_exam_subject_id, next_round, true, '{}'::jsonb, 'new')
  returning * into created_attempt;

  return created_attempt;
end;
$$;

grant execute on function public.start_next_attempt_round(bigint) to authenticated;
