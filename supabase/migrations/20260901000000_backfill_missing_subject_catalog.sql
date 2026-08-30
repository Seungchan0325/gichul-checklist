-- Some production projects applied the original catalog migration before all
-- elective subjects were included. Add only missing area/name pairs so existing
-- subject IDs and their linked exam records remain untouched.
insert into public.subjects (area, name, question_count, duration_seconds, sort_order)
select catalog.area, catalog.name, catalog.question_count, catalog.duration_seconds, catalog.sort_order
from (
  values
    ('국어', '화법과 작문', 45, 4800, 1), ('국어', '언어와 매체', 45, 4800, 2),
    ('수학', '확률과 통계', 30, 6000, 3), ('수학', '미적분', 30, 6000, 4), ('수학', '기하', 30, 6000, 5),
    ('영어', '영어', 45, 4200, 6), ('한국사', '한국사', 20, 1800, 7),
    ('사회탐구', '생활과 윤리', 20, 1800, 8), ('사회탐구', '윤리와 사상', 20, 1800, 9),
    ('사회탐구', '한국지리', 20, 1800, 10), ('사회탐구', '세계지리', 20, 1800, 11),
    ('사회탐구', '동아시아사', 20, 1800, 12), ('사회탐구', '세계사', 20, 1800, 13),
    ('사회탐구', '정치와 법', 20, 1800, 14), ('사회탐구', '경제', 20, 1800, 15), ('사회탐구', '사회·문화', 20, 1800, 16),
    ('과학탐구', '물리학Ⅰ', 20, 1800, 17), ('과학탐구', '물리학Ⅱ', 20, 1800, 18),
    ('과학탐구', '화학Ⅰ', 20, 1800, 19), ('과학탐구', '화학Ⅱ', 20, 1800, 20),
    ('과학탐구', '생명과학Ⅰ', 20, 1800, 21), ('과학탐구', '생명과학Ⅱ', 20, 1800, 22),
    ('과학탐구', '지구과학Ⅰ', 20, 1800, 23), ('과학탐구', '지구과학Ⅱ', 20, 1800, 24),
    ('직업탐구', '농업 기초 기술', 20, 1800, 25), ('직업탐구', '공업 일반', 20, 1800, 26),
    ('직업탐구', '상업 경제', 20, 1800, 27), ('직업탐구', '수산·해운 산업 기초', 20, 1800, 28),
    ('직업탐구', '인간 발달', 20, 1800, 29), ('직업탐구', '성공적인 직업 생활', 20, 1800, 30),
    ('제2외국어/한문', '독일어Ⅰ', 30, 2400, 31), ('제2외국어/한문', '프랑스어Ⅰ', 30, 2400, 32),
    ('제2외국어/한문', '스페인어Ⅰ', 30, 2400, 33), ('제2외국어/한문', '중국어Ⅰ', 30, 2400, 34),
    ('제2외국어/한문', '일본어Ⅰ', 30, 2400, 35), ('제2외국어/한문', '러시아어Ⅰ', 30, 2400, 36),
    ('제2외국어/한문', '아랍어Ⅰ', 30, 2400, 37), ('제2외국어/한문', '베트남어Ⅰ', 30, 2400, 38),
    ('제2외국어/한문', '한문Ⅰ', 30, 2400, 39)
) as catalog(area, name, question_count, duration_seconds, sort_order)
where not exists (
  select 1 from public.subjects subject where subject.area = catalog.area and subject.name = catalog.name
);
