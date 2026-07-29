-- 018: 대시보드 예정 알림용 pet_upcoming_rows() RPC 추가
-- 홈 대시보드가 반려동물의 '모든 기록'을 무제한 조회해 computeUpcoming 에 넣던 것을,
-- 필요한 최소 상위집합(라인별 최신 + 미완료 후속 예정)만 반환하는 함수로 대체한다.
-- computeUpcoming(JS)이 여전히 최종 판정의 단일 출처 — 이 함수는 그 입력의 상위집합만 보장한다.
-- security invoker 라 records RLS(구성원만)가 그대로 적용된다. (재실행 안전: create or replace)
create or replace function public.pet_upcoming_rows(p_pet_ids uuid[])
returns table (
  id uuid, pet_id uuid, category text, title text,
  event_on date, next_due_on date, recur_rule text, created_at timestamptz
)
language sql security invoker set search_path = public stable as $$
  with line_latest as (
    select distinct on (
      r.pet_id, r.category,
      case when r.category in ('접종','심장사상충','구충','외부기생충') then r.title else '' end
    )
      r.id, r.pet_id, r.category, r.title, r.event_on, r.next_due_on, r.recur_rule, r.created_at
    from public.records r
    where r.pet_id = any(p_pet_ids)
    order by
      r.pet_id, r.category,
      case when r.category in ('접종','심장사상충','구충','외부기생충') then r.title else '' end,
      r.event_on desc, r.created_at desc
  ),
  followups as (
    select r.id, r.pet_id, r.category, r.title, r.event_on, r.next_due_on, r.recur_rule, r.created_at
    from public.records r
    where r.pet_id = any(p_pet_ids)
      and r.recur_rule is null
      and r.next_due_on is not null
  )
  select * from line_latest
  union
  select * from followups;
$$;
