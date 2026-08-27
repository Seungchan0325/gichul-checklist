alter table public.exam_subjects
  add column status public.exam_status not null default 'draft',
  add column published_at timestamptz,
  add column updated_at timestamptz not null default now();

update public.exam_subjects exam_subject
set status = exam.status,
    published_at = exam.published_at
from public.exams exam
where exam.id = exam_subject.exam_id;

create trigger exam_subjects_set_updated_at before update on public.exam_subjects
for each row execute function public.set_updated_at();

drop policy "Users can read published exams" on public.exams;
drop policy "Users can read published exam subjects" on public.exam_subjects;
drop policy "Users can read published answer keys" on public.answer_keys;
drop policy "Users can read published exam PDFs" on storage.objects;

create policy "Users can read exams with published subjects" on public.exams
for select to authenticated using (
  (select public.is_admin()) or exists (
    select 1 from public.exam_subjects exam_subject
    where exam_subject.exam_id = exams.id and exam_subject.status = 'published'
  )
);

create policy "Users can read published exam subjects" on public.exam_subjects
for select to authenticated using (status = 'published' or (select public.is_admin()));

create policy "Users can read published answer keys" on public.answer_keys
for select to authenticated using (
  (select public.is_admin()) or exists (
    select 1 from public.exam_subjects exam_subject
    where exam_subject.id = answer_keys.exam_subject_id and exam_subject.status = 'published'
  )
);

create policy "Users can read published exam PDFs" on storage.objects
for select to authenticated using (
  bucket_id = 'exam-pdfs' and (
    (select public.is_admin()) or exists (
      select 1 from public.exam_subjects exam_subject
      where exam_subject.status = 'published'
        and (exam_subject.question_pdf_path = name or exam_subject.explanation_pdf_path = name)
    )
  )
);
