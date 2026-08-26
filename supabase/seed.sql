-- DEVELOPMENT SAMPLE DATA ONLY. Answers below are generated placeholders, not official exam answers.
insert into public.subjects (id, area, name, question_count, duration_seconds, sort_order) values
  (1, '국어', '화법과 작문', 45, 4800, 1), (2, '국어', '언어와 매체', 45, 4800, 2),
  (3, '수학', '확률과 통계', 30, 6000, 3), (4, '수학', '미적분', 30, 6000, 4), (5, '수학', '기하', 30, 6000, 5),
  (6, '영어', '영어', 45, 4200, 6), (7, '한국사', '한국사', 20, 1800, 7),
  (8, '사회탐구', '생활과 윤리', 20, 1800, 8), (9, '사회탐구', '윤리와 사상', 20, 1800, 9),
  (10, '사회탐구', '한국지리', 20, 1800, 10), (11, '사회탐구', '세계지리', 20, 1800, 11),
  (12, '사회탐구', '동아시아사', 20, 1800, 12), (13, '사회탐구', '세계사', 20, 1800, 13),
  (14, '사회탐구', '정치와 법', 20, 1800, 14), (15, '사회탐구', '경제', 20, 1800, 15), (16, '사회탐구', '사회·문화', 20, 1800, 16),
  (17, '과학탐구', '물리학Ⅰ', 20, 1800, 17), (18, '과학탐구', '물리학Ⅱ', 20, 1800, 18),
  (19, '과학탐구', '화학Ⅰ', 20, 1800, 19), (20, '과학탐구', '화학Ⅱ', 20, 1800, 20),
  (21, '과학탐구', '생명과학Ⅰ', 20, 1800, 21), (22, '과학탐구', '생명과학Ⅱ', 20, 1800, 22),
  (23, '과학탐구', '지구과학Ⅰ', 20, 1800, 23), (24, '과학탐구', '지구과학Ⅱ', 20, 1800, 24),
  (25, '직업탐구', '농업 기초 기술', 20, 1800, 25), (26, '직업탐구', '공업 일반', 20, 1800, 26),
  (27, '직업탐구', '상업 경제', 20, 1800, 27), (28, '직업탐구', '수산·해운 산업 기초', 20, 1800, 28),
  (29, '직업탐구', '인간 발달', 20, 1800, 29), (30, '직업탐구', '성공적인 직업 생활', 20, 1800, 30),
  (31, '제2외국어/한문', '독일어Ⅰ', 30, 2400, 31), (32, '제2외국어/한문', '프랑스어Ⅰ', 30, 2400, 32),
  (33, '제2외국어/한문', '스페인어Ⅰ', 30, 2400, 33), (34, '제2외국어/한문', '중국어Ⅰ', 30, 2400, 34),
  (35, '제2외국어/한문', '일본어Ⅰ', 30, 2400, 35), (36, '제2외국어/한문', '러시아어Ⅰ', 30, 2400, 36),
  (37, '제2외국어/한문', '아랍어Ⅰ', 30, 2400, 37), (38, '제2외국어/한문', '베트남어Ⅰ', 30, 2400, 38),
  (39, '제2외국어/한문', '한문Ⅰ', 30, 2400, 39);

select setval(pg_get_serial_sequence('public.subjects', 'id'), (select max(id) from public.subjects));

insert into public.exams (id, year, month, title, question_url, explanation_url, is_development_data) values
  (1, 2027, 3, '3월 전국연합학력평가', 'https://www.ebsi.co.kr', 'https://www.ebsi.co.kr', true),
  (2, 2027, 6, '6월 모의평가', 'https://www.ebsi.co.kr', 'https://www.ebsi.co.kr', true),
  (3, 2027, 9, '9월 모의평가', 'https://www.ebsi.co.kr', 'https://www.ebsi.co.kr', true),
  (4, 2026, 3, '3월 전국연합학력평가', 'https://www.ebsi.co.kr', 'https://www.ebsi.co.kr', true),
  (5, 2026, 6, '6월 모의평가', 'https://www.ebsi.co.kr', 'https://www.ebsi.co.kr', true),
  (6, 2026, 9, '9월 모의평가', 'https://www.ebsi.co.kr', 'https://www.ebsi.co.kr', true),
  (7, 2026, 11, '대학수학능력시험', 'https://www.ebsi.co.kr', 'https://www.ebsi.co.kr', true),
  (8, 2025, 6, '6월 모의평가', 'https://www.ebsi.co.kr', 'https://www.ebsi.co.kr', true),
  (9, 2025, 9, '9월 모의평가', 'https://www.ebsi.co.kr', 'https://www.ebsi.co.kr', true),
  (10, 2025, 11, '대학수학능력시험', 'https://www.ebsi.co.kr', 'https://www.ebsi.co.kr', true);

select setval(pg_get_serial_sequence('public.exams', 'id'), (select max(id) from public.exams));

insert into public.exam_subjects (exam_id, subject_id)
select e.id, s.id from public.exams e cross join public.subjects s;

insert into public.answer_keys (exam_subject_id, question_number, answer, points)
select es.id, q.number,
  case when s.area = '수학' and ((q.number between 16 and 22) or q.number >= 29)
    then (((es.exam_id * 17 + s.id * 11 + q.number * 7) % 999) + 1)::text
    else (((es.exam_id + s.id + q.number) % 5) + 1)::text end,
  case when s.question_count = 20 then 5
    when s.question_count = 45 and q.number <= 35 then 2
    when s.question_count = 45 then 3
    when s.question_count = 30 and q.number <= 20 then 3
    else 4 end
from public.exam_subjects es
join public.subjects s on s.id = es.subject_id
cross join lateral generate_series(1, s.question_count) as q(number);
