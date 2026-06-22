-- 수익화(monetization) 기반: 요금제(Freemium) + 제휴 클릭 로그
-- 1) profiles 에 plan/premium_until 추가 → 프리미엄(광고 제거 등) 구분
-- 2) affiliate_clicks 테이블 → 제휴 상품 클릭 전환 측정
-- 모두 idempotent(재실행 안전).

-- 1) profiles: 요금제 컬럼
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists premium_until timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_plan_check') then
    alter table public.profiles
      add constraint profiles_plan_check check (plan in ('free', 'premium'));
  end if;
end $$;

-- 2) affiliate_clicks: 제휴 상품 클릭 로그
create table if not exists public.affiliate_clicks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  product_id  text not null,
  context     text,
  created_at  timestamptz not null default now()
);

alter table public.affiliate_clicks drop constraint if exists affiliate_clicks_user_id_fkey;
alter table public.affiliate_clicks add constraint affiliate_clicks_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

create index if not exists idx_affiliate_clicks_product on public.affiliate_clicks (product_id, created_at desc);
create index if not exists idx_affiliate_clicks_created on public.affiliate_clicks (created_at desc);

-- RLS: 클릭 적재만 허용(본인 또는 비로그인), 조회/수정/삭제는 service_role 전용
alter table public.affiliate_clicks enable row level security;
drop policy if exists "affiliate_clicks_insert" on public.affiliate_clicks;
create policy "affiliate_clicks_insert" on public.affiliate_clicks for insert
  with check (user_id is null or auth.uid() = user_id);
