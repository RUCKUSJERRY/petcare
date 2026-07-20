-- lost_pet_sightings : 목격 제보 등록 시 신고자에게 알림 트리거
drop trigger if exists trg_notify_sighting on public.lost_pet_sightings;
create trigger trg_notify_sighting after insert on public.lost_pet_sightings
  for each row execute function public.notify_on_sighting();
