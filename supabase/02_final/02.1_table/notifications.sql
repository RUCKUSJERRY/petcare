-- notifications : 커뮤니티 알림 (댓글/답글/좋아요)
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,
  actor_id     uuid not null,
  type         text not null check (type in ('comment', 'like', 'reply')),
  post_id      uuid,
  comment_id   uuid,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
