-- 014: 실종 목격 제보 알림
-- 실종은 앱에서 가장 시급한 이벤트인데, 그동안 목격 제보가 저장만 되고 신고자에게 아무 알림이
-- 없어 상세 페이지를 계속 새로고침해야 알 수 있었다. 댓글/좋아요와 동일하게 in-app 알림을 남기고
-- (폰 푸시는 web-push라 DB에서 못 보내므로 클라이언트 서버액션이 별도 발송한다.)
-- 재실행 안전(idempotent).

-- 1) notifications: sighting 유형 + 대상 실종 신고(lost_pet_id) 컬럼
alter table public.notifications add column if not exists lost_pet_id uuid;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('comment', 'like', 'reply', 'sighting'));

-- 2) 목격 제보 → 신고자에게 알림 생성 함수 (예외 안전)
create or replace function public.notify_on_sighting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  begin
    select user_id into owner_id from public.lost_pets where id = new.lost_pet_id;
    if owner_id is not null and owner_id <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, lost_pet_id)
      values (owner_id, new.user_id, 'sighting', new.lost_pet_id);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

-- 3) 트리거
drop trigger if exists trg_notify_sighting on public.lost_pet_sightings;
create trigger trg_notify_sighting after insert on public.lost_pet_sightings
  for each row execute function public.notify_on_sighting();

-- 4) notification_list 뷰: n.* 의 컬럼 구성(lost_pet_id 추가)이 바뀌므로 drop 후 재생성
drop view if exists public.notification_list;
create view public.notification_list
with (security_invoker = on) as
select
  n.*,
  pr.display_name as actor_name,
  pr.avatar_url   as actor_avatar,
  p.title         as post_title,
  lp.name         as lost_pet_name
from public.notifications n
left join public.profiles  pr on pr.id = n.actor_id
left join public.posts     p  on p.id = n.post_id
left join public.lost_pets lp on lp.id = n.lost_pet_id;
