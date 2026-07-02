-- 카테고리 개편:
--  - 소변·대변 → '배변' 으로 통합 (세부 종류는 title 에 '소변'/'대변'/'둘다' 로 보관)
--  - '증상' → '진료' 로 대체 (증상 상세는 진료 기록의 진단·주제로 흡수)
--  - 신규 카테고리 '배변' 추가
-- 소변/대변/증상 값은 과거 데이터/롤백 안전을 위해 CHECK 에 그대로 남겨둔다.
-- 모두 idempotent(재실행 안전).

-- 1) CHECK 제약에 '배변' 추가 (마이그레이션 UPDATE 가 통과하도록 먼저 반영). drop 후 재생성.
alter table public.records drop constraint if exists records_category_check;
alter table public.records add constraint records_category_check check (category in (
  '접종','심장사상충','구충','외부기생충','건강검진','진료',
  '미용','양치','발톱','목욕','귀청소',
  '식사','간식','물','배변','투약',
  '소변','대변','증상',
  '기타'
));

-- 2) 소변/대변 → 배변. 세부 종류를 title 로 보존하고, 기존 상태 메모는 memo 로 이동한다.
update public.records set
  memo = case
           when coalesce(title,'') not in ('', '소변')
             then title || case when coalesce(memo,'') <> '' then E'\n' || memo else '' end
           else memo
         end,
  title = '소변',
  category = '배변'
where category = '소변';

update public.records set
  memo = case
           when coalesce(title,'') not in ('', '대변')
             then title || case when coalesce(memo,'') <> '' then E'\n' || memo else '' end
           else memo
         end,
  title = '대변',
  category = '배변'
where category = '대변';

-- 3) 증상 → 진료 (증상 텍스트는 진료 제목으로 유지)
update public.records set category = '진료'
where category = '증상';
