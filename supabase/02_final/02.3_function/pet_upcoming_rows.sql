-- pet_upcoming_rows : 대시보드 예정 알림용 '라인별 최신 + 미완료 후속' 행만 반환.
-- 홈 대시보드가 모든 기록을 통째로 불러와 computeUpcoming(JS) 에 넣던 것을, 필요한 최소
-- '상위집합(superset)'만 서버에서 추려 반환한다(무제한 조회 방지). computeUpcoming 이 여전히
-- 최종 판정의 단일 출처이며, 이 함수는 그 입력의 상위집합임을 보장한다:
--   (1) 항목 라인별 최신 기록 1건 (제품 카테고리 접종·심장사상충·구충·외부기생충은 title 까지 구분,
--       그 외는 pet·category 단위) — scheduleLineKey 와 동일 규칙
--   (2) 반복이 아니고 next_due_on 이 있는 모든 기록 — 최신 기록에 밀려 드롭될 수 있는 후속 예정 보존
-- security invoker 라 records RLS(구성원만 접근)가 그대로 적용된다.
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
