-- notify_on_sighting : 실종 목격 제보 등록 시 신고자에게 알림 생성 (예외 안전)
-- 실종은 앱에서 가장 시급한 이벤트라, 댓글/좋아요와 동일하게 in-app 알림을 남긴다.
-- (폰 푸시는 web-push라 DB에서 못 보내므로, 클라이언트가 저장 직후 서버액션으로 별도 발송)
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
