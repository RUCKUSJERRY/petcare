-- notifications : 커뮤니티 알림(댓글/답글/좋아요) + 실종 목격 제보 알림(sighting)
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,
  actor_id     uuid not null,
  type         text not null check (type in ('comment', 'like', 'reply', 'sighting')),
  post_id      uuid,
  comment_id   uuid,
  lost_pet_id  uuid,       -- sighting 알림의 대상 실종 신고 (커뮤니티 알림은 null)
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
