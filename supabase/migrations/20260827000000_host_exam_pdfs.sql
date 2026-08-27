alter table public.exams
  add column question_pdf_path text,
  add column explanation_pdf_path text;

alter table public.exams
  drop column question_url,
  drop column explanation_url;

insert into storage.buckets (id, name, public)
values ('exam-pdfs', 'exam-pdfs', false)
on conflict (id) do update set public = false;

create policy "Authenticated users can read exam PDFs"
on storage.objects for select to authenticated
using (bucket_id = 'exam-pdfs');
