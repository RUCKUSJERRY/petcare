-- pet_invitations : 반려동물 공동 관리 초대 (토큰 링크)
create table if not exists public.pet_invitations (
  id         uuid primary key default gen_random_uuid(),
  pet_id     uuid not null,
  token      uuid not null default gen_random_uuid() unique,
  invited_by uuid not null,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);
