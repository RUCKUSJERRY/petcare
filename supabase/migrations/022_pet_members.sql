-- ============================================================
--  022: 반려동물 공동 관리 (구성원 초대)
--  가족·친구 등과 한 반려동물을 함께 관리. 초대받은 구성원은
--  해당 반려동물의 모든 기록을 조회·기록할 수 있다. (권한 세분화는 추후)
--
--  핵심: 소유권(user_id) 기반 RLS → 멤버십(pet_members) 기반으로 교체.
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

-- ───────────────────────────────────────────────
-- 1. pet_members : 반려동물 구성원
-- ───────────────────────────────────────────────
create table if not exists public.pet_members (
  pet_id     uuid not null references public.pets(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (pet_id, user_id)
);
create index if not exists idx_pet_members_user on public.pet_members (user_id);

-- 기존 반려동물의 등록자를 owner로 백필
insert into public.pet_members (pet_id, user_id, role)
select id, user_id, 'owner' from public.pets
on conflict (pet_id, user_id) do nothing;

-- ───────────────────────────────────────────────
-- 2. 멤버십 헬퍼 (SECURITY DEFINER → pet_members RLS 우회로 재귀 방지)
-- ───────────────────────────────────────────────
create or replace function public.is_pet_member(p_pet_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.pet_members m
    where m.pet_id = p_pet_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_pet_owner(p_pet_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.pet_members m
    where m.pet_id = p_pet_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- 신규 반려동물 등록 시 등록자를 owner 구성원으로 자동 추가
create or replace function public.add_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.pet_members (pet_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict (pet_id, user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists trg_pet_owner_member on public.pets;
create trigger trg_pet_owner_member after insert on public.pets
  for each row execute function public.add_owner_member();

-- pet_members RLS
alter table public.pet_members enable row level security;
drop policy if exists "pet_members_select" on public.pet_members;
drop policy if exists "pet_members_insert" on public.pet_members;
drop policy if exists "pet_members_delete" on public.pet_members;
-- 조회: 같은 반려동물의 구성원끼리 서로 보임
create policy "pet_members_select" on public.pet_members for select
  using (public.is_pet_member(pet_id));
-- 추가: owner만 직접 추가 가능 (구성원 수락은 accept_pet_invitation 함수로 처리)
create policy "pet_members_insert" on public.pet_members for insert
  with check (public.is_pet_owner(pet_id));
-- 삭제: owner가 구성원 제거하거나, 본인이 탈퇴
create policy "pet_members_delete" on public.pet_members for delete
  using (public.is_pet_owner(pet_id) or user_id = auth.uid());

-- ───────────────────────────────────────────────
-- 3. pet_invitations : 초대 (토큰 링크)
-- ───────────────────────────────────────────────
create table if not exists public.pet_invitations (
  id         uuid primary key default gen_random_uuid(),
  pet_id     uuid not null references public.pets(id) on delete cascade,
  token      uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);
create index if not exists idx_pet_inv_pet on public.pet_invitations (pet_id);

alter table public.pet_invitations enable row level security;
drop policy if exists "pet_inv_select" on public.pet_invitations;
drop policy if exists "pet_inv_insert" on public.pet_invitations;
drop policy if exists "pet_inv_update" on public.pet_invitations;
drop policy if exists "pet_inv_delete" on public.pet_invitations;
-- 조회/생성/회수: owner만 (초대받은 사람은 get_pet_invitation 함수로 토큰 조회)
create policy "pet_inv_select" on public.pet_invitations for select using (public.is_pet_owner(pet_id));
create policy "pet_inv_insert" on public.pet_invitations for insert
  with check (public.is_pet_owner(pet_id) and invited_by = auth.uid());
create policy "pet_inv_update" on public.pet_invitations for update using (public.is_pet_owner(pet_id));
create policy "pet_inv_delete" on public.pet_invitations for delete using (public.is_pet_owner(pet_id));

-- 토큰으로 초대 정보 조회 (비구성원도 수락 화면에서 확인) — RLS 우회
create or replace function public.get_pet_invitation(p_token uuid)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'pet_id', inv.pet_id,
    'pet_name', p.name,
    'status', inv.status,
    'expired', (inv.expires_at < now()),
    'inviter', pr.display_name
  )
  from public.pet_invitations inv
  left join public.pets p on p.id = inv.pet_id
  left join public.profiles pr on pr.id = inv.invited_by
  where inv.token = p_token;
$$;

-- 초대 수락 → 구성원으로 등록
create or replace function public.accept_pet_invitation(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pet uuid; v_status text; v_exp timestamptz;
begin
  select pet_id, status, expires_at into v_pet, v_status, v_exp
  from public.pet_invitations where token = p_token;
  if v_pet is null then raise exception 'invalid_invitation'; end if;
  if v_status <> 'pending' then raise exception 'not_pending'; end if;
  if v_exp < now() then raise exception 'expired'; end if;
  insert into public.pet_members (pet_id, user_id, role)
    values (v_pet, auth.uid(), 'member')
    on conflict (pet_id, user_id) do nothing;
  update public.pet_invitations set status = 'accepted' where token = p_token;
  return v_pet;
end;
$$;

-- ───────────────────────────────────────────────
-- 4. RLS 교체: 소유권(user_id) → 멤버십(is_pet_member)
-- ───────────────────────────────────────────────

-- pets : 구성원이면 조회/수정, owner만 삭제. 등록은 본인 명의로.
drop policy if exists "본인 반려동물만 조회" on public.pets;
drop policy if exists "본인 반려동물만 등록" on public.pets;
drop policy if exists "본인 반려동물만 수정" on public.pets;
drop policy if exists "본인 반려동물만 삭제" on public.pets;
drop policy if exists "pets_member_select" on public.pets;
drop policy if exists "pets_insert_own"   on public.pets;
drop policy if exists "pets_member_update" on public.pets;
drop policy if exists "pets_owner_delete"  on public.pets;
create policy "pets_member_select" on public.pets for select
  using (public.is_pet_member(id) or user_id = auth.uid());
create policy "pets_insert_own" on public.pets for insert
  with check (auth.uid() = user_id);
create policy "pets_member_update" on public.pets for update
  using (public.is_pet_member(id));
create policy "pets_owner_delete" on public.pets for delete
  using (public.is_pet_owner(id) or user_id = auth.uid());

-- weight_logs
drop policy if exists "weight_owner_select" on public.weight_logs;
drop policy if exists "weight_owner_insert" on public.weight_logs;
drop policy if exists "weight_owner_update" on public.weight_logs;
drop policy if exists "weight_owner_delete" on public.weight_logs;
create policy "weight_owner_select" on public.weight_logs for select using (public.is_pet_member(pet_id));
create policy "weight_owner_insert" on public.weight_logs for insert with check (public.is_pet_member(pet_id));
create policy "weight_owner_update" on public.weight_logs for update using (public.is_pet_member(pet_id));
create policy "weight_owner_delete" on public.weight_logs for delete using (public.is_pet_member(pet_id));

-- vaccination_records (건강 관리 기록)
drop policy if exists "vacc_owner_select" on public.vaccination_records;
drop policy if exists "vacc_owner_insert" on public.vaccination_records;
drop policy if exists "vacc_owner_update" on public.vaccination_records;
drop policy if exists "vacc_owner_delete" on public.vaccination_records;
create policy "vacc_owner_select" on public.vaccination_records for select using (public.is_pet_member(pet_id));
create policy "vacc_owner_insert" on public.vaccination_records for insert with check (public.is_pet_member(pet_id));
create policy "vacc_owner_update" on public.vaccination_records for update using (public.is_pet_member(pet_id));
create policy "vacc_owner_delete" on public.vaccination_records for delete using (public.is_pet_member(pet_id));

-- medical_records (진료 기록)
drop policy if exists "medical_owner_select" on public.medical_records;
drop policy if exists "medical_owner_insert" on public.medical_records;
drop policy if exists "medical_owner_update" on public.medical_records;
drop policy if exists "medical_owner_delete" on public.medical_records;
create policy "medical_owner_select" on public.medical_records for select using (public.is_pet_member(pet_id));
create policy "medical_owner_insert" on public.medical_records for insert with check (public.is_pet_member(pet_id));
create policy "medical_owner_update" on public.medical_records for update using (public.is_pet_member(pet_id));
create policy "medical_owner_delete" on public.medical_records for delete using (public.is_pet_member(pet_id));
