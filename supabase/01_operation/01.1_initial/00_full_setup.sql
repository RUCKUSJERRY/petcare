-- =============================================================
--  00_full_setup.sql  — 신규 DB 통합 세팅본 (자동 생성)
--  ⚠ 직접 수정하지 마세요. supabase/02_final/* 를 수정한 뒤
--     `npm run db:build` 로 재생성합니다.
--  생성 시각: 2026-07-20T00:20:08.505Z
-- =============================================================


-- ┌──────────────────────────────────────────────
-- │ 02.1_table
-- └──────────────────────────────────────────────

-- ── 02.1_table/admin_users.sql ──
-- admin_users : 관리자 계정 (운영자만). 서버/SQL로만 관리하며 RLS로 클라이언트 접근 차단.
-- 권한 상승 방지를 위해 profiles.is_admin 컬럼 대신 별도 테이블로 분리한다.
create table if not exists public.admin_users (
  user_id    uuid primary key,
  created_at timestamptz not null default now()
);

-- ── 02.1_table/affiliate_clicks.sql ──
-- affiliate_clicks : 제휴 상품 클릭 로그 (수익화 - 어필리에이트 전환 측정용)
-- 어떤 상품을 어느 화면(context)에서 눌렀는지 적재해 제휴 매출/클릭률 분석에 사용한다.
create table if not exists public.affiliate_clicks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  product_id  text not null,
  context     text,
  created_at  timestamptz not null default now()
);

-- ── 02.1_table/ai_usage.sql ──
-- ai_usage : AI 기능 호출 로그 (서버측 사용량 제한용)
-- OCR 등 외부 LLM 비용이 드는 기능의 사용자별 호출을 기록해 시간당 횟수를 제한한다.
create table if not exists public.ai_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  kind        text not null,            -- 'ocr' 등 기능 구분
  created_at  timestamptz not null default now()
);

-- ── 02.1_table/app_settings.sql ──
-- app_settings : 운영 설정 키-값 저장소 (가격·광고 토글 등). 코드 수정/재배포 없이 변경.
-- 공개 읽기(가격·광고 노출 판단), 쓰기는 관리자만(RLS).
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- ── 02.1_table/breed_food_rules.sql ──
-- breed_food_rules : 견종/묘종별 음식 예외 규칙 (override)
create table if not exists public.breed_food_rules (
  id              uuid primary key default gen_random_uuid(),
  breed_id        uuid not null,
  food_id         uuid not null,
  override_safety text not null check (override_safety in ('safe', 'caution', 'dangerous')),
  note            text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (breed_id, food_id)
);

-- ── 02.1_table/breeds.sql ──
-- breeds : 견종/묘종 마스터 (강아지·고양이 품종 정보)
create table if not exists public.breeds (
  id              uuid primary key default gen_random_uuid(),
  name_ko         text not null,
  name_en         text,
  size_category   text check (size_category in ('소형', '중형', '대형')),
  avg_lifespan    int,
  characteristics text,
  species         text not null default 'dog' check (species in ('dog','cat')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 02.1_table/comments.sql ──
-- comments : 게시글 댓글 (대댓글 1단계 + 수정 시각 포함)
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null,
  user_id     uuid not null,
  content     text not null check (char_length(content) between 1 and 1000),
  parent_id   uuid references public.comments(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── 02.1_table/food_items.sql ──
-- food_items : 음식 항목 마스터 (안전도는 food_safety 가 종별로 관리)
create table if not exists public.food_items (
  id         uuid primary key default gen_random_uuid(),
  name_ko    text not null unique,
  category   text check (category in ('육류','채소','과일','유제품','기타')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── 02.1_table/food_safety.sql ──
-- food_safety : 음식별·종별 안전도 (개/고양이 분리)
create table if not exists public.food_safety (
  id           uuid primary key default gen_random_uuid(),
  food_id      uuid not null,
  species      text not null check (species in ('dog','cat')),
  safety_level text not null check (safety_level in ('safe','caution','dangerous')),
  reason       text,
  caution      text,
  source       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (food_id, species)
);

-- ── 02.1_table/health_guides.sql ──
-- health_guides : 건강 가이드 (종/견종/크기/나이 범위별)
create table if not exists public.health_guides (
  id            uuid primary key default gen_random_uuid(),
  breed_id      uuid,                                          -- null = 공통
  size_category text check (size_category in ('소형','중형','대형')),
  species       text not null default 'dog' check (species in ('dog','cat')),
  age_month_min int not null,
  age_month_max int not null,
  category      text not null,
  title         text not null,
  description   text not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  constraint chk_health_scope check (not (breed_id is not null and size_category is not null)),
  constraint chk_health_age   check (age_month_min <= age_month_max)
);

-- ── 02.1_table/lost_pet_sightings.sql ──
-- lost_pet_sightings : 실종 반려동물 목격 제보 (댓글)
create table if not exists public.lost_pet_sightings (
  id          uuid primary key default gen_random_uuid(),
  lost_pet_id uuid not null,
  user_id     uuid not null,
  content     text not null check (char_length(content) between 1 and 1000),
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now()
);

-- ── 02.1_table/lost_pets.sql ──
-- lost_pets : 실종 반려동물 제보 (지도 기반)
create table if not exists public.lost_pets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  name           text,
  species        text not null check (species in ('dog', 'cat')),
  breed_id       uuid,
  gender         text check (gender in ('수컷', '암컷')),
  photo_url      text,
  photo_urls     text[],
  lost_at        date not null default current_date,
  lat            double precision not null,
  lng            double precision not null,
  area_text      text,
  description    text,
  contact        text,
  contact_public boolean not null default true,
  status         text not null default 'active' check (status in ('active', 'found')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── 02.1_table/map_favorites.sql ──
-- map_favorites : 지도 즐겨찾기 (동물병원/카페/식당)
create table if not exists public.map_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  place_id    text not null,
  place_name  text not null,
  category    text,
  address     text,
  phone       text,
  lat         double precision not null,
  lng         double precision not null,
  place_url   text,
  created_at  timestamptz not null default now(),
  unique (user_id, place_id)
);

-- ── 02.1_table/notifications.sql ──
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

-- ── 02.1_table/payments.sql ──
-- payments : 결제 이력 (첫 결제 + 매월 자동결제). 분석/정산·중복결제 방지용.
-- order_id 는 멱등키(같은 주문 중복 승인 방지). 서버 전용(RLS 정책 미정의).
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  order_id     text not null unique,
  payment_key  text,
  amount       integer not null check (amount >= 0),
  status       text not null default 'DONE',
  method       text,
  kind         text not null default 'initial' check (kind in ('initial', 'renewal')),
  created_at   timestamptz not null default now()
);

-- ── 02.1_table/pet_invitations.sql ──
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

-- ── 02.1_table/pet_members.sql ──
-- pet_members : 반려동물 공동 관리 구성원
create table if not exists public.pet_members (
  pet_id     uuid not null,
  user_id    uuid not null,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (pet_id, user_id)
);

-- ── 02.1_table/pets.sql ──
-- pets : 사용자의 반려동물
create table if not exists public.pets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  name             text not null,
  breed_id         uuid,
  birth_year       int,                                              -- 선택(나이 미상 허용)
  birth_month      int check (birth_month between 1 and 12),         -- 선택(나이 미상 허용)
  birth_day        smallint check (birth_day is null or birth_day between 1 and 31),
  adopted_on       date,
  gender           text check (gender in ('수컷', '암컷')),
  weight_kg        float check (weight_kg is null or weight_kg > 0),
  photo_url        text,
  species          text not null default 'dog' check (species in ('dog','cat')),
  target_weight_kg float check (target_weight_kg is null or target_weight_kg > 0),
  care_type        text not null default 'own' check (care_type in ('own','foster')),  -- 'foster'=임시보호
  created_at       timestamptz default now()
);

-- 기존 테이블 보강 (재실행 안전) — birth_day(생일 '일'), adopted_on(입양일)
alter table public.pets add column if not exists birth_day smallint;
alter table public.pets add column if not exists adopted_on date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pets_birth_day_check') then
    alter table public.pets
      add constraint pets_birth_day_check check (birth_day is null or birth_day between 1 and 31);
  end if;
end $$;

-- 나이 미상(구조·임보) 허용 — birth_year/birth_month 선택값화 (재실행 안전)
alter table public.pets alter column birth_year  drop not null;
alter table public.pets alter column birth_month drop not null;

-- 임시보호(foster) 여부 (재실행 안전)
alter table public.pets add column if not exists care_type text not null default 'own';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pets_care_type_check') then
    alter table public.pets add constraint pets_care_type_check check (care_type in ('own','foster'));
  end if;
end $$;

-- ── 02.1_table/post_likes.sql ──
-- post_likes : 게시글 좋아요 (중복 방지)
create table if not exists public.post_likes (
  post_id     uuid not null,
  user_id     uuid not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ── 02.1_table/posts.sql ──
-- posts : 커뮤니티 게시글
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  category    text not null check (category in ('질문','자랑','정보공유','일상')),
  title       text not null check (char_length(title) between 1 and 100),
  content     text not null check (char_length(content) between 1 and 5000),
  breed_id    uuid,
  image_url   text,
  image_urls  text[],
  like_count  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── 02.1_table/profiles.sql ──
-- profiles : 사용자 표시 정보 (auth.users 1:1)
create table if not exists public.profiles (
  id            uuid primary key,
  display_name  text not null,
  avatar_url    text,
  plan          text not null default 'free' check (plan in ('free', 'premium')),
  premium_until timestamptz,
  created_at    timestamptz not null default now()
);

-- 기존 테이블 보강 (재실행 안전) — 요금제(plan)·프리미엄 만료일(premium_until)
-- plan='premium' 이고 premium_until 이 미래(또는 null=무기한)이면 프리미엄으로 본다.
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists premium_until timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_plan_check') then
    alter table public.profiles
      add constraint profiles_plan_check check (plan in ('free', 'premium'));
  end if;
end $$;

-- ── 02.1_table/push_subscriptions.sql ──
-- push_subscriptions : 웹 푸시 구독 정보 (브라우저별 endpoint/키)
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── 02.1_table/record_grooming.sql ──
-- record_grooming : records 미용 상세 (1:1)
create table if not exists public.record_grooming (
  record_id   uuid primary key,
  method      text,
  vendor      text,
  groom_type  text
);

-- ── 02.1_table/record_meal.sql ──
-- record_meal : records 식사/간식 상세 (1:1)
create table if not exists public.record_meal (
  record_id   uuid primary key,
  food_kind   text,
  mix         text,
  amount      text
);

-- ── 02.1_table/record_medical.sql ──
-- record_medical : records 진료 상세 (1:1)
create table if not exists public.record_medical (
  record_id   uuid primary key,
  reason      text,
  treatment   text,
  medication  text
);

-- ── 02.1_table/records.sql ──
-- records : 통합 기록 모델 (캘린더형 공통 기록)
create table if not exists public.records (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null,
  category         text not null check (category in (
                     '접종','심장사상충','구충','외부기생충','건강검진','진료',
                     '미용','양치','발톱','목욕','귀청소',
                     '식사','간식','물','배변','투약',
                     -- 레거시(신규 입력 제외, 과거 데이터 호환): 소변·대변→배변, 증상→진료
                     '소변','대변','증상',
                     '기타'
                   )),
  title            text not null,
  event_on         date not null default current_date,
  event_at         timestamptz,                  -- 생활기록 시각(시간순 타임라인용). 일정 기록은 NULL
  place_name       text,
  place_lat        double precision,
  place_lng        double precision,
  cost             integer check (cost is null or cost >= 0),
  memo             text,
  photo_url        text,
  photo_urls       text[],
  recur_rule       text,
  next_due_on      date,
  last_reminded_on date,
  created_at       timestamptz not null default now()
);

-- ── 02.1_table/subscriptions.sql ──
-- subscriptions : 프리미엄 정기결제(토스 빌링) 구독. 사용자당 1행.
-- billing_key(결제수단 토큰)는 민감정보 → RLS로 클라이언트 접근을 전면 차단하고
-- 서버(service_role)에서만 읽고 쓴다. (정책 미정의 = 서버 전용)
create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique,
  status             text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  billing_key        text not null,
  customer_key       text not null,
  card_company       text,
  card_number_masked text,
  amount             integer not null check (amount >= 0),
  current_period_end timestamptz not null,
  canceled_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── 02.1_table/walk_comments.sql ──
-- walk_comments : 산책 기록 댓글
create table if not exists public.walk_comments (
  id         uuid primary key default gen_random_uuid(),
  walk_id    uuid not null,
  user_id    uuid not null,
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- ── 02.1_table/walk_goals.sql ──
-- walk_goals : 사용자별 주간 산책 목표 (거리 km · 횟수). 사용자당 1행, 0 = 미설정.
create table if not exists public.walk_goals (
  user_id      uuid primary key,
  distance_km  numeric not null default 0 check (distance_km >= 0),
  count        integer not null default 0 check (count >= 0),
  updated_at   timestamptz not null default now()
);

-- ── 02.1_table/walk_guides.sql ──
-- walk_guides : 활동 가이드 (산책/놀이/훈련 등, 종/견종/크기/나이 범위별)
create table if not exists public.walk_guides (
  id            uuid primary key default gen_random_uuid(),
  breed_id      uuid,                                          -- null = 공통
  size_category text check (size_category in ('소형','중형','대형')),
  species       text not null default 'dog' check (species in ('dog','cat')),
  age_month_min int not null,
  age_month_max int not null,
  daily_minutes int not null,
  intensity     text not null check (intensity in ('가벼움', '보통', '활발')),
  tips          text,
  activity_type text not null default '산책',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  constraint chk_walk_scope   check (not (breed_id is not null and size_category is not null)),
  constraint chk_walk_age      check (age_month_min <= age_month_max),
  constraint chk_walk_minutes  check (daily_minutes > 0)
);

-- ── 02.1_table/walk_likes.sql ──
-- walk_likes : 산책 기록 좋아요 (중복 방지)
create table if not exists public.walk_likes (
  walk_id    uuid not null,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (walk_id, user_id)
);

-- ── 02.1_table/walks.sql ──
-- walks : 산책 기록 + 경로 공유
create table if not exists public.walks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  pet_id      uuid,
  title       text,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  duration_s  integer not null check (duration_s >= 0),
  distance_m  integer not null check (distance_m >= 0),
  path        jsonb   not null default '[]'::jsonb,
  is_public   boolean not null default false,
  area_text   text,
  note        text,
  like_count  int not null default 0,
  photo_url   text,
  created_at  timestamptz not null default now()
);

-- ── 02.1_table/weight_logs.sql ──
-- weight_logs : 반려동물 체중 기록
create table if not exists public.weight_logs (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null,
  weight_kg   float not null check (weight_kg > 0),
  measured_on date not null default current_date,
  note        text,
  created_at  timestamptz not null default now()
);

-- ┌──────────────────────────────────────────────
-- │ 02.2_index_fk
-- └──────────────────────────────────────────────

-- ── 02.2_index_fk/admin_users.sql ──
-- admin_users : 외래키 (PK가 user_id라 별도 인덱스 불필요)
alter table public.admin_users drop constraint if exists admin_users_user_id_fkey;
alter table public.admin_users add constraint admin_users_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- ── 02.2_index_fk/affiliate_clicks.sql ──
-- affiliate_clicks : 외래키 + 인덱스
-- user_id 는 비로그인 클릭(null)도 허용하므로 not null 로 두지 않는다. 삭제 시 로그는 보존.
alter table public.affiliate_clicks drop constraint if exists affiliate_clicks_user_id_fkey;
alter table public.affiliate_clicks add constraint affiliate_clicks_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

create index if not exists idx_affiliate_clicks_product on public.affiliate_clicks (product_id, created_at desc);
create index if not exists idx_affiliate_clicks_created on public.affiliate_clicks (created_at desc);

-- ── 02.2_index_fk/ai_usage.sql ──
-- ai_usage : 외래키 + 인덱스
alter table public.ai_usage drop constraint if exists ai_usage_user_id_fkey;
alter table public.ai_usage add constraint ai_usage_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- 사용자별 최근 호출(시간당 카운트) 조회용
create index if not exists idx_ai_usage_user_kind_at on public.ai_usage (user_id, kind, created_at desc);

-- ── 02.2_index_fk/breed_food_rules.sql ──
-- breed_food_rules : 외래키 + 인덱스
alter table public.breed_food_rules drop constraint if exists breed_food_rules_breed_id_fkey;
alter table public.breed_food_rules add constraint breed_food_rules_breed_id_fkey
  foreign key (breed_id) references public.breeds(id) on delete cascade;
alter table public.breed_food_rules drop constraint if exists breed_food_rules_food_id_fkey;
alter table public.breed_food_rules add constraint breed_food_rules_food_id_fkey
  foreign key (food_id) references public.food_items(id) on delete cascade;

-- ── 02.2_index_fk/comments.sql ──
-- comments : 외래키 + 인덱스 (parent_id 자기참조는 테이블 정의에 포함)
alter table public.comments drop constraint if exists comments_post_id_fkey;
alter table public.comments add constraint comments_post_id_fkey
  foreign key (post_id) references public.posts(id) on delete cascade;
alter table public.comments drop constraint if exists comments_user_id_fkey;
alter table public.comments add constraint comments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create index if not exists idx_comments_post   on public.comments (post_id, created_at);
create index if not exists idx_comments_parent on public.comments (parent_id, created_at);

-- ── 02.2_index_fk/food_safety.sql ──
-- food_safety : 외래키 + 인덱스
alter table public.food_safety drop constraint if exists food_safety_food_id_fkey;
alter table public.food_safety add constraint food_safety_food_id_fkey
  foreign key (food_id) references public.food_items(id) on delete cascade;

create index if not exists idx_food_safety_food on public.food_safety (food_id);

-- ── 02.2_index_fk/health_guides.sql ──
-- health_guides : 외래키 + 인덱스
alter table public.health_guides drop constraint if exists health_guides_breed_id_fkey;
alter table public.health_guides add constraint health_guides_breed_id_fkey
  foreign key (breed_id) references public.breeds(id) on delete cascade;

-- ── 02.2_index_fk/lost_pet_sightings.sql ──
-- lost_pet_sightings : 외래키 + 인덱스
alter table public.lost_pet_sightings drop constraint if exists lost_pet_sightings_lost_pet_id_fkey;
alter table public.lost_pet_sightings add constraint lost_pet_sightings_lost_pet_id_fkey
  foreign key (lost_pet_id) references public.lost_pets(id) on delete cascade;
alter table public.lost_pet_sightings drop constraint if exists lost_pet_sightings_user_id_fkey;
alter table public.lost_pet_sightings add constraint lost_pet_sightings_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_sighting_lost on public.lost_pet_sightings (lost_pet_id, created_at);

-- ── 02.2_index_fk/lost_pets.sql ──
-- lost_pets : 외래키 + 인덱스
alter table public.lost_pets drop constraint if exists lost_pets_user_id_fkey;
alter table public.lost_pets add constraint lost_pets_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.lost_pets drop constraint if exists lost_pets_breed_id_fkey;
alter table public.lost_pets add constraint lost_pets_breed_id_fkey
  foreign key (breed_id) references public.breeds(id) on delete set null;

create index if not exists idx_lost_status_created on public.lost_pets (status, created_at desc);

-- ── 02.2_index_fk/map_favorites.sql ──
-- map_favorites : 외래키 + 인덱스
alter table public.map_favorites drop constraint if exists map_favorites_user_id_fkey;
alter table public.map_favorites add constraint map_favorites_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_map_fav_user on public.map_favorites (user_id, created_at desc);

-- ── 02.2_index_fk/notifications.sql ──
-- notifications : 외래키 + 인덱스
alter table public.notifications drop constraint if exists notifications_recipient_id_fkey;
alter table public.notifications add constraint notifications_recipient_id_fkey
  foreign key (recipient_id) references public.profiles(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_actor_id_fkey;
alter table public.notifications add constraint notifications_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_post_id_fkey;
alter table public.notifications add constraint notifications_post_id_fkey
  foreign key (post_id) references public.posts(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_comment_id_fkey;
alter table public.notifications add constraint notifications_comment_id_fkey
  foreign key (comment_id) references public.comments(id) on delete cascade;

create index if not exists idx_notif_recipient on public.notifications (recipient_id, created_at desc);
create index if not exists idx_notif_unread on public.notifications (recipient_id) where read = false;

-- ── 02.2_index_fk/payments.sql ──
-- payments : 외래키 + 인덱스
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_payments_user on public.payments (user_id, created_at desc);

-- ── 02.2_index_fk/pet_invitations.sql ──
-- pet_invitations : 외래키 + 인덱스
alter table public.pet_invitations drop constraint if exists pet_invitations_pet_id_fkey;
alter table public.pet_invitations add constraint pet_invitations_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete cascade;
alter table public.pet_invitations drop constraint if exists pet_invitations_invited_by_fkey;
alter table public.pet_invitations add constraint pet_invitations_invited_by_fkey
  foreign key (invited_by) references public.profiles(id) on delete cascade;

create index if not exists idx_pet_inv_pet on public.pet_invitations (pet_id);

-- ── 02.2_index_fk/pet_members.sql ──
-- pet_members : 외래키 + 인덱스
alter table public.pet_members drop constraint if exists pet_members_pet_id_fkey;
alter table public.pet_members add constraint pet_members_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete cascade;
alter table public.pet_members drop constraint if exists pet_members_user_id_fkey;
alter table public.pet_members add constraint pet_members_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_pet_members_user on public.pet_members (user_id);

-- ── 02.2_index_fk/pets.sql ──
-- pets : 외래키 + 인덱스
alter table public.pets drop constraint if exists pets_user_id_fkey;
alter table public.pets add constraint pets_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.pets drop constraint if exists pets_breed_id_fkey;
alter table public.pets add constraint pets_breed_id_fkey
  foreign key (breed_id) references public.breeds(id);

-- ── 02.2_index_fk/post_likes.sql ──
-- post_likes : 외래키
alter table public.post_likes drop constraint if exists post_likes_post_id_fkey;
alter table public.post_likes add constraint post_likes_post_id_fkey
  foreign key (post_id) references public.posts(id) on delete cascade;
alter table public.post_likes drop constraint if exists post_likes_user_id_fkey;
alter table public.post_likes add constraint post_likes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ── 02.2_index_fk/posts.sql ──
-- posts : 외래키 + 인덱스
alter table public.posts drop constraint if exists posts_user_id_fkey;
alter table public.posts add constraint posts_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.posts drop constraint if exists posts_breed_id_fkey;
alter table public.posts add constraint posts_breed_id_fkey
  foreign key (breed_id) references public.breeds(id) on delete set null;

create index if not exists idx_posts_created  on public.posts (created_at desc);
create index if not exists idx_posts_category on public.posts (category, created_at desc);

-- ── 02.2_index_fk/profiles.sql ──
-- profiles : 외래키 (auth.users)
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- ── 02.2_index_fk/push_subscriptions.sql ──
-- push_subscriptions : 외래키 + 인덱스
alter table public.push_subscriptions drop constraint if exists push_subscriptions_user_id_fkey;
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_push_sub_user on public.push_subscriptions (user_id);
create index if not exists idx_push_sub_updated_at on public.push_subscriptions (updated_at);

-- ── 02.2_index_fk/record_grooming.sql ──
-- record_grooming : 외래키 (records 1:1)
alter table public.record_grooming drop constraint if exists record_grooming_record_id_fkey;
alter table public.record_grooming add constraint record_grooming_record_id_fkey
  foreign key (record_id) references public.records(id) on delete cascade;

-- ── 02.2_index_fk/record_meal.sql ──
-- record_meal : 외래키 (records 1:1)
alter table public.record_meal drop constraint if exists record_meal_record_id_fkey;
alter table public.record_meal add constraint record_meal_record_id_fkey
  foreign key (record_id) references public.records(id) on delete cascade;

-- ── 02.2_index_fk/record_medical.sql ──
-- record_medical : 외래키 (records 1:1)
alter table public.record_medical drop constraint if exists record_medical_record_id_fkey;
alter table public.record_medical add constraint record_medical_record_id_fkey
  foreign key (record_id) references public.records(id) on delete cascade;

-- ── 02.2_index_fk/records.sql ──
-- records : 외래키 + 인덱스
alter table public.records drop constraint if exists records_pet_id_fkey;
alter table public.records add constraint records_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete cascade;

create index if not exists idx_records_pet_event on public.records (pet_id, event_on desc);
create index if not exists idx_records_pet_due   on public.records (pet_id, next_due_on);
create index if not exists idx_records_pet_event_at on public.records (pet_id, event_at desc);

-- ── 02.2_index_fk/subscriptions.sql ──
-- subscriptions : 외래키 + 인덱스
alter table public.subscriptions drop constraint if exists subscriptions_user_id_fkey;
alter table public.subscriptions add constraint subscriptions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- 갱신 크론이 "결제 예정 도래분"을 빠르게 찾기 위한 인덱스
create index if not exists idx_subscriptions_renew on public.subscriptions (status, current_period_end);

-- ── 02.2_index_fk/walk_comments.sql ──
-- walk_comments : 외래키 + 인덱스
alter table public.walk_comments drop constraint if exists walk_comments_walk_id_fkey;
alter table public.walk_comments add constraint walk_comments_walk_id_fkey
  foreign key (walk_id) references public.walks(id) on delete cascade;
alter table public.walk_comments drop constraint if exists walk_comments_user_id_fkey;
alter table public.walk_comments add constraint walk_comments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

create index if not exists idx_walk_comments on public.walk_comments (walk_id, created_at);

-- ── 02.2_index_fk/walk_goals.sql ──
-- walk_goals : 외래키 (PK가 user_id라 별도 인덱스 불필요)
alter table public.walk_goals drop constraint if exists walk_goals_user_id_fkey;
alter table public.walk_goals add constraint walk_goals_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- ── 02.2_index_fk/walk_guides.sql ──
-- walk_guides : 외래키 + 인덱스
alter table public.walk_guides drop constraint if exists walk_guides_breed_id_fkey;
alter table public.walk_guides add constraint walk_guides_breed_id_fkey
  foreign key (breed_id) references public.breeds(id) on delete cascade;

-- ── 02.2_index_fk/walk_likes.sql ──
-- walk_likes : 외래키
alter table public.walk_likes drop constraint if exists walk_likes_walk_id_fkey;
alter table public.walk_likes add constraint walk_likes_walk_id_fkey
  foreign key (walk_id) references public.walks(id) on delete cascade;
alter table public.walk_likes drop constraint if exists walk_likes_user_id_fkey;
alter table public.walk_likes add constraint walk_likes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- ── 02.2_index_fk/walks.sql ──
-- walks : 외래키 + 인덱스
alter table public.walks drop constraint if exists walks_user_id_fkey;
alter table public.walks add constraint walks_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.walks drop constraint if exists walks_pet_id_fkey;
alter table public.walks add constraint walks_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete set null;

create index if not exists idx_walks_user on public.walks (user_id, started_at desc);
create index if not exists idx_walks_public on public.walks (created_at desc) where is_public;

-- ── 02.2_index_fk/weight_logs.sql ──
-- weight_logs : 외래키 + 인덱스
alter table public.weight_logs drop constraint if exists weight_logs_pet_id_fkey;
alter table public.weight_logs add constraint weight_logs_pet_id_fkey
  foreign key (pet_id) references public.pets(id) on delete cascade;

create index if not exists idx_weight_logs_pet on public.weight_logs (pet_id, measured_on);

-- ┌──────────────────────────────────────────────
-- │ 02.3_function
-- └──────────────────────────────────────────────

-- ── 02.3_function/accept_pet_invitation.sql ──
-- accept_pet_invitation : 초대 수락 → 구성원으로 등록
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

-- ── 02.3_function/add_owner_member.sql ──
-- add_owner_member : 반려동물 등록 시 등록자를 owner 구성원으로 추가
create or replace function public.add_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.pet_members (pet_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict (pet_id, user_id) do nothing;
  return new;
end;
$$;

-- ── 02.3_function/get_pet_invitation.sql ──
-- get_pet_invitation : 토큰으로 초대 정보 조회 (RLS 우회)
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

-- ── 02.3_function/handle_new_user.sql ──
-- handle_new_user : 신규 가입 시 profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      '익명의 보호자'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 02.3_function/is_admin.sql ──
-- is_admin : 현재 사용자가 관리자인지 (RLS 헬퍼 + 클라이언트 rpc 용)
-- security definer 라 RLS로 막힌 admin_users 를 우회 조회한다.
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

-- ── 02.3_function/is_pet_member.sql ──
-- is_pet_member : 현재 사용자가 해당 반려동물 구성원인지 (RLS 헬퍼)
create or replace function public.is_pet_member(p_pet_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.pet_members m
    where m.pet_id = p_pet_id and m.user_id = auth.uid()
  );
$$;

-- ── 02.3_function/is_pet_owner.sql ──
-- is_pet_owner : 현재 사용자가 해당 반려동물 owner인지 (RLS 헬퍼)
create or replace function public.is_pet_owner(p_pet_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.pet_members m
    where m.pet_id = p_pet_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- ── 02.3_function/notify_on_comment.sql ──
-- notify_on_comment : 댓글/답글 작성 시 알림 생성 (예외 안전, 답글이면 reply)
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  notif_type text;
begin
  begin
    if new.parent_id is not null then
      -- 답글 → 부모 댓글 작성자에게
      select user_id into target_id from public.comments where id = new.parent_id;
      notif_type := 'reply';
    else
      -- 최상위 댓글 → 글 작성자에게
      select user_id into target_id from public.posts where id = new.post_id;
      notif_type := 'comment';
    end if;

    if target_id is not null and target_id <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (target_id, new.user_id, notif_type, new.post_id, new.id);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

-- ── 02.3_function/notify_on_like.sql ──
-- notify_on_like : 좋아요 시 게시글 작성자에게 알림 (예외 안전)
create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  begin
    select user_id into author_id from public.posts where id = new.post_id;
    if author_id is not null and author_id <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (author_id, new.user_id, 'like', new.post_id);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

-- ── 02.3_function/notify_on_sighting.sql ──
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

-- ── 02.3_function/remove_like_notification.sql ──
-- remove_like_notification : 좋아요 취소 시 해당 알림 제거 (예외 안전)
create or replace function public.remove_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    delete from public.notifications
    where type = 'like' and post_id = old.post_id and actor_id = old.user_id;
  exception when others then
    null;
  end;
  return old;
end;
$$;

-- ── 02.3_function/sync_like_count.sql ──
-- sync_like_count : 게시글 좋아요 수 자동 동기화
create or replace function public.sync_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

-- ── 02.3_function/sync_walk_like_count.sql ──
-- sync_walk_like_count : 산책 기록 좋아요 수 자동 동기화
create or replace function public.sync_walk_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.walks set like_count = like_count + 1 where id = new.walk_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.walks set like_count = greatest(like_count - 1, 0) where id = old.walk_id;
    return old;
  end if;
  return null;
end;
$$;

-- ── 02.3_function/touch_updated_at.sql ──
-- touch_updated_at : updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── 02.3_function/transfer_pet_ownership.sql ──
-- transfer_pet_ownership : 반려동물 소유권 이전 (임보→입양 등)
-- 현재 owner 만 호출 가능하고, 넘길 대상은 이미 이 아이의 구성원(공동관리 초대 수락)이어야 한다.
-- pet_members 역할을 교체하고 pets.user_id(명의)를 새 주인으로 갱신한다(임보→소유 전환).
create or replace function public.transfer_pet_ownership(p_pet_id uuid, p_new_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_pet_owner(p_pet_id) then
    raise exception 'not_owner';
  end if;
  if p_new_owner = auth.uid() then
    raise exception 'same_owner';
  end if;
  if not exists (
    select 1 from public.pet_members
    where pet_id = p_pet_id and user_id = p_new_owner
  ) then
    raise exception 'not_member';
  end if;
  update public.pet_members set role = 'owner'  where pet_id = p_pet_id and user_id = p_new_owner;
  update public.pet_members set role = 'member' where pet_id = p_pet_id and user_id = auth.uid();
  update public.pets set user_id = p_new_owner, care_type = 'own' where id = p_pet_id;
end;
$$;

-- ┌──────────────────────────────────────────────
-- │ 02.4_trigger
-- └──────────────────────────────────────────────

-- ── 02.4_trigger/app_settings.sql ──
-- app_settings : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_app_settings on public.app_settings;
create trigger trg_touch_app_settings before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ── 02.4_trigger/auth_users.sql ──
-- auth.users : 신규 가입 시 profiles 자동 생성 트리거
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 02.4_trigger/breed_food_rules.sql ──
-- breed_food_rules : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_breed_food_rules on public.breed_food_rules;
create trigger trg_touch_breed_food_rules before update on public.breed_food_rules
  for each row execute function public.touch_updated_at();

-- ── 02.4_trigger/breeds.sql ──
-- breeds : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_breeds on public.breeds;
create trigger trg_touch_breeds before update on public.breeds
  for each row execute function public.touch_updated_at();

-- ── 02.4_trigger/comments.sql ──
-- comments : 댓글/답글 작성 시 알림 트리거
drop trigger if exists trg_notify_comment on public.comments;
create trigger trg_notify_comment after insert on public.comments
  for each row execute function public.notify_on_comment();

-- ── 02.4_trigger/food_items.sql ──
-- food_items : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_food_items on public.food_items;
create trigger trg_touch_food_items before update on public.food_items
  for each row execute function public.touch_updated_at();

-- ── 02.4_trigger/food_safety.sql ──
-- food_safety : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_food_safety on public.food_safety;
create trigger trg_touch_food_safety before update on public.food_safety
  for each row execute function public.touch_updated_at();

-- ── 02.4_trigger/health_guides.sql ──
-- health_guides : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_health_guides on public.health_guides;
create trigger trg_touch_health_guides before update on public.health_guides
  for each row execute function public.touch_updated_at();

-- ── 02.4_trigger/lost_pet_sightings.sql ──
-- lost_pet_sightings : 목격 제보 등록 시 신고자에게 알림 트리거
drop trigger if exists trg_notify_sighting on public.lost_pet_sightings;
create trigger trg_notify_sighting after insert on public.lost_pet_sightings
  for each row execute function public.notify_on_sighting();

-- ── 02.4_trigger/lost_pets.sql ──
-- lost_pets : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_lost on public.lost_pets;
create trigger trg_touch_lost before update on public.lost_pets
  for each row execute function public.touch_updated_at();

-- ── 02.4_trigger/pets.sql ──
-- pets : 등록 시 등록자를 owner 구성원으로 자동 추가하는 트리거
drop trigger if exists trg_pet_owner_member on public.pets;
create trigger trg_pet_owner_member after insert on public.pets
  for each row execute function public.add_owner_member();

-- ── 02.4_trigger/post_likes.sql ──
-- post_likes : 좋아요 수 동기화 + 알림 생성/제거 트리거
drop trigger if exists trg_like_count_ins on public.post_likes;
drop trigger if exists trg_like_count_del on public.post_likes;
create trigger trg_like_count_ins after insert on public.post_likes
  for each row execute function public.sync_like_count();
create trigger trg_like_count_del after delete on public.post_likes
  for each row execute function public.sync_like_count();

drop trigger if exists trg_notify_like_ins on public.post_likes;
drop trigger if exists trg_notify_like_del on public.post_likes;
create trigger trg_notify_like_ins after insert on public.post_likes
  for each row execute function public.notify_on_like();
create trigger trg_notify_like_del after delete on public.post_likes
  for each row execute function public.remove_like_notification();

-- ── 02.4_trigger/subscriptions.sql ──
-- subscriptions : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_subscriptions on public.subscriptions;
create trigger trg_touch_subscriptions before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ── 02.4_trigger/walk_goals.sql ──
-- walk_goals : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_walk_goals on public.walk_goals;
create trigger trg_touch_walk_goals before update on public.walk_goals
  for each row execute function public.touch_updated_at();

-- ── 02.4_trigger/walk_guides.sql ──
-- walk_guides : updated_at 자동 갱신 트리거
drop trigger if exists trg_touch_walk_guides on public.walk_guides;
create trigger trg_touch_walk_guides before update on public.walk_guides
  for each row execute function public.touch_updated_at();

-- ── 02.4_trigger/walk_likes.sql ──
-- walk_likes : 산책 좋아요 수 동기화 트리거
drop trigger if exists trg_walk_like_ins on public.walk_likes;
drop trigger if exists trg_walk_like_del on public.walk_likes;
create trigger trg_walk_like_ins after insert on public.walk_likes
  for each row execute function public.sync_walk_like_count();
create trigger trg_walk_like_del after delete on public.walk_likes
  for each row execute function public.sync_walk_like_count();

-- ┌──────────────────────────────────────────────
-- │ 02.5_view
-- └──────────────────────────────────────────────

-- ── 02.5_view/notification_list.sql ──
-- notification_list : 알림 목록 뷰 (actor 프로필 + 게시글 제목 + 실종 대상 이름, security_invoker)
create or replace view public.notification_list
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

-- ── 02.5_view/post_list.sql ──
-- post_list : 게시글 목록 뷰 (작성자/견종/댓글 수 조인)
create or replace view public.post_list as
select
  p.*,
  pr.display_name as author_name,
  pr.avatar_url   as author_avatar,
  b.name_ko       as breed_name,
  (select count(*) from public.comments c where c.post_id = p.id) as comment_count
from public.posts p
left join public.profiles pr on pr.id = p.user_id
left join public.breeds   b  on b.id = p.breed_id;

-- ┌──────────────────────────────────────────────
-- │ 02.6_policy
-- └──────────────────────────────────────────────

-- ── 02.6_policy/admin_users.sql ──
-- admin_users : RLS (서버 전용). 정책 미정의 → anon/authenticated 접근 차단.
-- 관리자 여부 확인은 security definer 함수 is_admin() 으로 우회 조회한다.
alter table public.admin_users enable row level security;

-- ── 02.6_policy/affiliate_clicks.sql ──
-- affiliate_clicks : RLS (클릭 적재는 누구나 insert, 조회/수정/삭제는 막음 - 분석은 service_role)
-- 본인 클릭이면 user_id=auth.uid(), 비로그인이면 user_id is null 로만 insert 허용.
alter table public.affiliate_clicks enable row level security;
drop policy if exists "affiliate_clicks_insert" on public.affiliate_clicks;
create policy "affiliate_clicks_insert" on public.affiliate_clicks for insert
  with check (user_id is null or auth.uid() = user_id);

-- ── 02.6_policy/ai_usage.sql ──
-- ai_usage : RLS (본인 사용기록만 조회/생성)
alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage_select_own" on public.ai_usage;
drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage for select using (auth.uid() = user_id);
create policy "ai_usage_insert_own" on public.ai_usage for insert with check (auth.uid() = user_id);

-- ── 02.6_policy/app_settings.sql ──
-- app_settings : RLS (공개 읽기, 관리자만 쓰기)
alter table public.app_settings enable row level security;
drop policy if exists "app_settings_read"   on public.app_settings;
drop policy if exists "app_settings_insert"  on public.app_settings;
drop policy if exists "app_settings_update"  on public.app_settings;
create policy "app_settings_read"   on public.app_settings for select using (true);
create policy "app_settings_insert" on public.app_settings for insert with check (public.is_admin());
create policy "app_settings_update" on public.app_settings for update using (public.is_admin()) with check (public.is_admin());

-- ── 02.6_policy/breed_food_rules.sql ──
-- breed_food_rules : RLS + 공개 읽기 정책
alter table public.breed_food_rules enable row level security;
drop policy if exists "breed_food_rules 공개 읽기" on public.breed_food_rules;
create policy "breed_food_rules 공개 읽기" on public.breed_food_rules for select using (true);

-- ── 02.6_policy/breeds.sql ──
-- breeds : RLS + 공개 읽기 정책
alter table public.breeds enable row level security;
drop policy if exists "breeds 공개 읽기" on public.breeds;
create policy "breeds 공개 읽기" on public.breeds for select using (true);

-- ── 02.6_policy/comments.sql ──
-- comments : RLS (공개 읽기, 본인 댓글 작성/수정/삭제)
alter table public.comments enable row level security;
drop policy if exists "read_comments"        on public.comments;
drop policy if exists "insert_own_comment"   on public.comments;
drop policy if exists "update_own_comment"   on public.comments;
drop policy if exists "delete_own_comment"   on public.comments;
create policy "read_comments"      on public.comments for select using (true);
create policy "insert_own_comment" on public.comments for insert with check (auth.uid() = user_id);
create policy "update_own_comment" on public.comments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete_own_comment" on public.comments for delete using (auth.uid() = user_id);

-- ── 02.6_policy/food_items.sql ──
-- food_items : RLS + 공개 읽기 정책
alter table public.food_items enable row level security;
drop policy if exists "food_items 공개 읽기" on public.food_items;
create policy "food_items 공개 읽기" on public.food_items for select using (true);

-- ── 02.6_policy/food_safety.sql ──
-- food_safety : RLS + 공개 읽기 정책
alter table public.food_safety enable row level security;
drop policy if exists "food_safety 공개 읽기" on public.food_safety;
create policy "food_safety 공개 읽기" on public.food_safety for select using (true);

-- ── 02.6_policy/health_guides.sql ──
-- health_guides : RLS + 공개 읽기 정책
alter table public.health_guides enable row level security;
drop policy if exists "health_guides 공개 읽기" on public.health_guides;
create policy "health_guides 공개 읽기" on public.health_guides for select using (true);

-- ── 02.6_policy/lost_pet_sightings.sql ──
-- lost_pet_sightings : RLS (공개 읽기, 본인만 작성/삭제)
alter table public.lost_pet_sightings enable row level security;
drop policy if exists "sighting_select" on public.lost_pet_sightings;
drop policy if exists "sighting_insert_own" on public.lost_pet_sightings;
drop policy if exists "sighting_delete_own" on public.lost_pet_sightings;
create policy "sighting_select"     on public.lost_pet_sightings for select using (true);
create policy "sighting_insert_own" on public.lost_pet_sightings for insert with check (auth.uid() = user_id);
create policy "sighting_delete_own" on public.lost_pet_sightings for delete using (auth.uid() = user_id);

-- ── 02.6_policy/lost_pets.sql ──
-- lost_pets : RLS (공개 읽기, 본인만 작성/수정/삭제)
alter table public.lost_pets enable row level security;
drop policy if exists "lost_select" on public.lost_pets;
drop policy if exists "lost_insert_own" on public.lost_pets;
drop policy if exists "lost_update_own" on public.lost_pets;
drop policy if exists "lost_delete_own" on public.lost_pets;
create policy "lost_select"     on public.lost_pets for select using (true);
create policy "lost_insert_own" on public.lost_pets for insert with check (auth.uid() = user_id);
create policy "lost_update_own" on public.lost_pets for update using (auth.uid() = user_id);
create policy "lost_delete_own" on public.lost_pets for delete using (auth.uid() = user_id);

-- ── 02.6_policy/map_favorites.sql ──
-- map_favorites : RLS (본인 즐겨찾기만 조회/생성/삭제)
alter table public.map_favorites enable row level security;
drop policy if exists "map_fav_select_own" on public.map_favorites;
drop policy if exists "map_fav_insert_own" on public.map_favorites;
drop policy if exists "map_fav_delete_own" on public.map_favorites;
create policy "map_fav_select_own" on public.map_favorites for select using (auth.uid() = user_id);
create policy "map_fav_insert_own" on public.map_favorites for insert with check (auth.uid() = user_id);
create policy "map_fav_delete_own" on public.map_favorites for delete using (auth.uid() = user_id);

-- ── 02.6_policy/notifications.sql ──
-- notifications : RLS (수신자 본인만 조회/수정/삭제, insert는 트리거로만)
alter table public.notifications enable row level security;
drop policy if exists "notif_select_own" on public.notifications;
drop policy if exists "notif_update_own" on public.notifications;
drop policy if exists "notif_delete_own" on public.notifications;
create policy "notif_select_own" on public.notifications for select
  using (auth.uid() = recipient_id);
create policy "notif_update_own" on public.notifications for update
  using (auth.uid() = recipient_id);
create policy "notif_delete_own" on public.notifications for delete
  using (auth.uid() = recipient_id);

-- ── 02.6_policy/payments.sql ──
-- payments : RLS (서버 전용)
-- 결제 이력은 서버(service_role)에서만 적재/조회한다. 정책 미정의 = 클라이언트 차단.
alter table public.payments enable row level security;

-- ── 02.6_policy/pet_invitations.sql ──
-- pet_invitations : RLS (owner만 조회/생성/수정/삭제)
alter table public.pet_invitations enable row level security;
drop policy if exists "pet_inv_select" on public.pet_invitations;
drop policy if exists "pet_inv_insert" on public.pet_invitations;
drop policy if exists "pet_inv_update" on public.pet_invitations;
drop policy if exists "pet_inv_delete" on public.pet_invitations;
create policy "pet_inv_select" on public.pet_invitations for select using (public.is_pet_owner(pet_id));
create policy "pet_inv_insert" on public.pet_invitations for insert
  with check (public.is_pet_owner(pet_id) and invited_by = auth.uid());
create policy "pet_inv_update" on public.pet_invitations for update using (public.is_pet_owner(pet_id));
create policy "pet_inv_delete" on public.pet_invitations for delete using (public.is_pet_owner(pet_id));

-- ── 02.6_policy/pet_members.sql ──
-- pet_members : RLS (구성원끼리 조회, owner만 추가, owner/본인 삭제)
alter table public.pet_members enable row level security;
drop policy if exists "pet_members_select" on public.pet_members;
drop policy if exists "pet_members_insert" on public.pet_members;
drop policy if exists "pet_members_delete" on public.pet_members;
create policy "pet_members_select" on public.pet_members for select
  using (public.is_pet_member(pet_id));
create policy "pet_members_insert" on public.pet_members for insert
  with check (public.is_pet_owner(pet_id));
create policy "pet_members_delete" on public.pet_members for delete
  using (public.is_pet_owner(pet_id) or user_id = auth.uid());

-- ── 02.6_policy/pets.sql ──
-- pets : RLS (멤버십 기반 조회/수정, owner만 삭제, 본인 명의 등록)
alter table public.pets enable row level security;
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

-- ── 02.6_policy/post_likes.sql ──
-- post_likes : RLS (공개 읽기, 본인 좋아요만 생성/삭제)
alter table public.post_likes enable row level security;
drop policy if exists "read_likes"       on public.post_likes;
drop policy if exists "insert_own_like"  on public.post_likes;
drop policy if exists "delete_own_like"  on public.post_likes;
create policy "read_likes"      on public.post_likes for select using (true);
create policy "insert_own_like" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "delete_own_like" on public.post_likes for delete using (auth.uid() = user_id);

-- ── 02.6_policy/posts.sql ──
-- posts : RLS (공개 읽기, 본인 글만 작성/수정/삭제)
alter table public.posts enable row level security;
drop policy if exists "read_posts"        on public.posts;
drop policy if exists "insert_own_post"   on public.posts;
drop policy if exists "update_own_post"   on public.posts;
drop policy if exists "delete_own_post"   on public.posts;
create policy "read_posts"      on public.posts for select using (true);
create policy "insert_own_post" on public.posts for insert with check (auth.uid() = user_id);
create policy "update_own_post" on public.posts for update using (auth.uid() = user_id);
create policy "delete_own_post" on public.posts for delete using (auth.uid() = user_id);

-- ── 02.6_policy/profiles.sql ──
-- profiles : RLS (공개 읽기, 본인만 수정)
alter table public.profiles enable row level security;
drop policy if exists "read_profiles"  on public.profiles;
drop policy if exists "update_own_profile" on public.profiles;
create policy "read_profiles"       on public.profiles for select using (true);
create policy "update_own_profile"  on public.profiles for update using (auth.uid() = id);

-- ── 02.6_policy/push_subscriptions.sql ──
-- push_subscriptions : RLS (본인 구독만 조회/생성/수정/삭제)
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_sub_select_own" on public.push_subscriptions;
drop policy if exists "push_sub_insert_own" on public.push_subscriptions;
drop policy if exists "push_sub_update_own" on public.push_subscriptions;
drop policy if exists "push_sub_delete_own" on public.push_subscriptions;
create policy "push_sub_select_own" on public.push_subscriptions for select
  using (auth.uid() = user_id);
create policy "push_sub_insert_own" on public.push_subscriptions for insert
  with check (auth.uid() = user_id);
create policy "push_sub_update_own" on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "push_sub_delete_own" on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- ── 02.6_policy/record_grooming.sql ──
-- record_grooming : RLS (부모 records 의 반려동물 멤버십으로 검사)
alter table public.record_grooming enable row level security;
drop policy if exists "record_grooming_select" on public.record_grooming;
drop policy if exists "record_grooming_insert" on public.record_grooming;
drop policy if exists "record_grooming_update" on public.record_grooming;
drop policy if exists "record_grooming_delete" on public.record_grooming;
create policy "record_grooming_select" on public.record_grooming for select
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_grooming_insert" on public.record_grooming for insert
  with check (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_grooming_update" on public.record_grooming for update
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_grooming_delete" on public.record_grooming for delete
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));

-- ── 02.6_policy/record_meal.sql ──
-- record_meal : RLS (부모 records 의 반려동물 멤버십으로 검사)
alter table public.record_meal enable row level security;
drop policy if exists "record_meal_select" on public.record_meal;
drop policy if exists "record_meal_insert" on public.record_meal;
drop policy if exists "record_meal_update" on public.record_meal;
drop policy if exists "record_meal_delete" on public.record_meal;
create policy "record_meal_select" on public.record_meal for select
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_meal_insert" on public.record_meal for insert
  with check (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_meal_update" on public.record_meal for update
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_meal_delete" on public.record_meal for delete
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));

-- ── 02.6_policy/record_medical.sql ──
-- record_medical : RLS (부모 records 의 반려동물 멤버십으로 검사)
alter table public.record_medical enable row level security;
drop policy if exists "record_medical_select" on public.record_medical;
drop policy if exists "record_medical_insert" on public.record_medical;
drop policy if exists "record_medical_update" on public.record_medical;
drop policy if exists "record_medical_delete" on public.record_medical;
create policy "record_medical_select" on public.record_medical for select
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_medical_insert" on public.record_medical for insert
  with check (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_medical_update" on public.record_medical for update
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));
create policy "record_medical_delete" on public.record_medical for delete
  using (exists (select 1 from public.records r where r.id = record_id and public.is_pet_member(r.pet_id)));

-- ── 02.6_policy/records.sql ──
-- records : RLS (반려동물 구성원만 접근)
alter table public.records enable row level security;
drop policy if exists "records_member_select" on public.records;
drop policy if exists "records_member_insert" on public.records;
drop policy if exists "records_member_update" on public.records;
drop policy if exists "records_member_delete" on public.records;
create policy "records_member_select" on public.records for select using (public.is_pet_member(pet_id));
create policy "records_member_insert" on public.records for insert with check (public.is_pet_member(pet_id));
create policy "records_member_update" on public.records for update using (public.is_pet_member(pet_id));
create policy "records_member_delete" on public.records for delete using (public.is_pet_member(pet_id));

-- ── 02.6_policy/subscriptions.sql ──
-- subscriptions : RLS (서버 전용)
-- billing_key 등 결제수단 토큰을 보호하기 위해 클라이언트 직접 접근을 전면 차단한다.
-- RLS를 켜고 정책을 만들지 않으면 anon/authenticated는 어떤 행도 읽고 쓸 수 없고,
-- service_role(서버 라우트)만 접근한다. 구독 상태 표시는 /api/billing/me 가 대신 제공.
alter table public.subscriptions enable row level security;

-- ── 02.6_policy/walk_comments.sql ──
-- walk_comments : RLS (공유/본인 산책에만 댓글 조회·생성, 본인 댓글만 삭제)
alter table public.walk_comments enable row level security;
drop policy if exists "walk_comments_select"     on public.walk_comments;
drop policy if exists "walk_comments_insert_own" on public.walk_comments;
drop policy if exists "walk_comments_delete_own" on public.walk_comments;
create policy "walk_comments_select" on public.walk_comments for select
  using (exists (select 1 from public.walks w
    where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_comments_insert_own" on public.walk_comments for insert
  with check (auth.uid() = user_id and exists (
    select 1 from public.walks w where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_comments_delete_own" on public.walk_comments for delete
  using (auth.uid() = user_id);

-- ── 02.6_policy/walk_goals.sql ──
-- walk_goals : RLS (본인 목표만 조회/생성/수정)
alter table public.walk_goals enable row level security;
drop policy if exists "walk_goals_select_own" on public.walk_goals;
drop policy if exists "walk_goals_insert_own" on public.walk_goals;
drop policy if exists "walk_goals_update_own" on public.walk_goals;
create policy "walk_goals_select_own" on public.walk_goals for select using (auth.uid() = user_id);
create policy "walk_goals_insert_own" on public.walk_goals for insert with check (auth.uid() = user_id);
create policy "walk_goals_update_own" on public.walk_goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 02.6_policy/walk_guides.sql ──
-- walk_guides : RLS + 공개 읽기 정책
alter table public.walk_guides enable row level security;
drop policy if exists "walk_guides 공개 읽기" on public.walk_guides;
create policy "walk_guides 공개 읽기" on public.walk_guides for select using (true);

-- ── 02.6_policy/walk_likes.sql ──
-- walk_likes : RLS (공유/본인 산책에만 좋아요 조회·생성, 본인 좋아요만 삭제)
alter table public.walk_likes enable row level security;
drop policy if exists "walk_likes_select"     on public.walk_likes;
drop policy if exists "walk_likes_insert_own" on public.walk_likes;
drop policy if exists "walk_likes_delete_own" on public.walk_likes;
create policy "walk_likes_select" on public.walk_likes for select
  using (exists (select 1 from public.walks w
    where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_likes_insert_own" on public.walk_likes for insert
  with check (auth.uid() = user_id and exists (
    select 1 from public.walks w where w.id = walk_id and (w.is_public or w.user_id = auth.uid())));
create policy "walk_likes_delete_own" on public.walk_likes for delete
  using (auth.uid() = user_id);

-- ── 02.6_policy/walks.sql ──
-- walks : RLS (본인 기록 + 공유 기록 조회, 본인만 생성/수정/삭제)
alter table public.walks enable row level security;
drop policy if exists "walks_select" on public.walks;
drop policy if exists "walks_insert_own" on public.walks;
drop policy if exists "walks_update_own" on public.walks;
drop policy if exists "walks_delete_own" on public.walks;
create policy "walks_select" on public.walks for select
  using (auth.uid() = user_id or is_public = true);
create policy "walks_insert_own" on public.walks for insert
  with check (auth.uid() = user_id);
create policy "walks_update_own" on public.walks for update
  using (auth.uid() = user_id);
create policy "walks_delete_own" on public.walks for delete
  using (auth.uid() = user_id);

-- ── 02.6_policy/weight_logs.sql ──
-- weight_logs : RLS (반려동물 구성원만 접근)
alter table public.weight_logs enable row level security;
drop policy if exists "weight_owner_select" on public.weight_logs;
drop policy if exists "weight_owner_insert" on public.weight_logs;
drop policy if exists "weight_owner_update" on public.weight_logs;
drop policy if exists "weight_owner_delete" on public.weight_logs;
create policy "weight_owner_select" on public.weight_logs for select using (public.is_pet_member(pet_id));
create policy "weight_owner_insert" on public.weight_logs for insert with check (public.is_pet_member(pet_id));
create policy "weight_owner_update" on public.weight_logs for update using (public.is_pet_member(pet_id));
create policy "weight_owner_delete" on public.weight_logs for delete using (public.is_pet_member(pet_id));

-- ┌──────────────────────────────────────────────
-- │ 02.7_data
-- └──────────────────────────────────────────────

-- ── 02.7_data/admin_users.sql ──
-- admin_users : 초기 관리자 지정 (해당 이메일로 가입돼 있어야 적용; 미가입이면 no-op).
-- 가입 후 이 구문을 다시 실행하면 관리자로 등록된다. 재실행 안전.
insert into public.admin_users (user_id)
select id from auth.users where email = 'yongjun5645@gmail.com'
on conflict (user_id) do nothing;

-- ── 02.7_data/app_settings.sql ──
-- app_settings : 기본값 시드 (없을 때만 삽입 → 관리자가 바꾼 값은 보존)
insert into public.app_settings (key, value) values
  ('premium_price_krw', '3900'),
  ('ads_enabled', 'true'),
  ('ad_cooldown_min', '3'),
  ('upsell_dismiss_min', '1440'),
  ('banner_dismiss_min', '1440'),
  ('free_ocr_monthly', '5')
on conflict (key) do nothing;

-- ── 02.7_data/breed_food_rules.sql ──
-- breed_food_rules : 견종/묘종별 음식 예외 규칙 시드 (출처: AKC, ASPCA, VCA)
insert into public.breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, v.lvl, v.note
from (values
  ('푸들(토이)',        '땅콩버터', 'dangerous', '토이 푸들은 췌장염에 취약합니다. 고지방 식품인 땅콩버터는 소량이라도 췌장염을 유발할 수 있어요'),
  ('푸들(토이)',        '우유',     'dangerous', '소형 푸들은 유당 민감도가 높아 우유가 심한 소화 장애를 유발할 수 있어요'),
  ('푸들(토이)',        '감자',     'caution',   '토이 푸들은 저혈당에 주의가 필요해요. 감자 등 탄수화물은 적당량만 주세요'),
  ('말티즈',            '우유',     'dangerous', '말티즈는 유당 불내성이 심해 우유가 극심한 설사·구토를 유발할 수 있어요'),
  ('말티즈',            '땅콩버터', 'dangerous', '말티즈는 고지방 식품에 민감해 췌장염 위험이 있어요. 땅콩버터는 피하세요'),
  ('닥스훈트',          '땅콩버터', 'dangerous', '닥스훈트는 비만 시 척추 디스크에 심각한 부담을 줍니다. 고칼로리 땅콩버터는 피하세요'),
  ('닥스훈트',          '감자',     'caution',   '닥스훈트는 체중 관리가 척추 건강에 필수입니다. 감자 급여는 최소화하세요'),
  ('비글',              '땅콩버터', 'dangerous', '비글은 비만 경향이 매우 강해요. 고칼로리 땅콩버터는 체중 관리를 방해합니다'),
  ('비글',              '감자',     'caution',   '비글은 과식 경향이 있어요. 감자 급여량을 엄격히 제한하세요'),
  ('프렌치불독',        '땅콩버터', 'dangerous', '프렌치불독은 비만이 호흡 문제를 악화시킵니다. 고칼로리 땅콩버터는 피하세요'),
  ('프렌치불독',        '브로콜리', 'caution',   '브로콜리는 가스를 유발해 단두종인 프렌치불독의 호흡 불편을 악화시킬 수 있어요'),
  ('포메라니안',        '땅콩버터', 'dangerous', '포메라니안은 고지방 식품이 탈모 증후군(BSD)을 악화시킬 수 있어요'),
  ('포메라니안',        '우유',     'dangerous', '포메라니안은 유당 민감도가 높아 우유가 소화 장애를 유발할 수 있어요'),
  ('시츄',              '우유',     'dangerous', '시츄는 소화기가 민감해 우유로 인한 설사·구토가 심하게 나타날 수 있어요'),
  ('시츄',              '브로콜리', 'caution',   '브로콜리의 가스는 단두종인 시츄의 호흡 불편을 악화시킬 수 있어요'),
  ('래브라도 리트리버', '땅콩버터', 'caution',   '래브라도는 비만 경향이 강해요. 땅콩버터는 소량만 간식으로 주세요'),
  ('골든 리트리버',     '땅콩버터', 'caution',   '골든 리트리버는 체중 관리가 중요해요. 땅콩버터는 극소량만 허용하세요'),
  ('페르시안',          '우유',     'dangerous', '페르시안은 유당 민감도가 매우 높아 우유가 심한 설사를 유발해요. 고양이 전용 우유만 허용'),
  ('메인쿤',            '치즈',     'dangerous', '메인쿤은 심근증 위험이 있어 유제품 등 지방·염분 부담 식품을 피해야 해요'),
  ('코리안 숏헤어',     '우유',     'dangerous', '코리안 숏헤어는 요로질환 경향이 있어요. 유제품의 미네랄 부담을 피하세요')
) as v(breed_ko, food_ko, lvl, note)
join public.breeds b on b.name_ko = v.breed_ko
join public.food_items f on f.name_ko = v.food_ko
on conflict (breed_id, food_id) do nothing;

-- ── 02.7_data/breeds.sql ──
-- breeds : 시드 데이터 (테이블이 비어있을 때만 삽입 → 재실행 안전)
do $$
begin
if not exists (select 1 from public.breeds) then

-- breeds : 견종/묘종 마스터 시드 (강아지 28종 + 고양이 13종)
-- 강아지 (species=dog, 기본값)
insert into public.breeds (name_ko, name_en, size_category, avg_lifespan, characteristics) values
('말티즈', 'Maltese', '소형', 15, '활발하고 애교가 많음. 슬개골 탈구, 기관 허탈 주의'),
('포메라니안', 'Pomeranian', '소형', 14, '호기심 많고 에너지 넘침. 탈모 증후군 주의'),
('치와와', 'Chihuahua', '소형', 16, '충성심 강하고 겁이 없음. 저혈당, 수두증 주의'),
('푸들(토이)', 'Toy Poodle', '소형', 15, '영리하고 훈련성 높음. 진행성 망막 위축 주의'),
('시츄', 'Shih Tzu', '소형', 14, '온순하고 적응력 좋음. 안구 돌출, 호흡기 주의'),
('비숑프리제', 'Bichon Frise', '소형', 14, '명랑하고 사람 좋아함. 피부 알레르기 주의'),
('닥스훈트', 'Dachshund', '소형', 14, '호기심 강하고 고집 있음. 척추 디스크 주의'),
('웰시코기', 'Welsh Corgi', '소형', 13, '영리하고 활동적. 고관절 이형성증 주의'),
('비글', 'Beagle', '중형', 13, '호기심 많고 활발. 비만, 척추 주의'),
('보더콜리', 'Border Collie', '중형', 13, '매우 영리하고 활동량 많음. 눈 질환 주의'),
('래브라도 리트리버', 'Labrador Retriever', '대형', 12, '온순하고 사교적. 고관절 이형성증, 비만 주의'),
('골든 리트리버', 'Golden Retriever', '대형', 11, '친근하고 온순. 암 발생률 높음, 정기 검진 중요'),
('진돗개', 'Jindo', '중형', 14, '충성심 강하고 독립적. 비교적 건강한 편'),
('시베리안 허스키', 'Siberian Husky', '중형', 13, '활동량 매우 많음. 눈 질환, 피부 주의'),
('프렌치불독', 'French Bulldog', '소형', 11, '온순하고 적응력 좋음. 호흡기, 척추 주의 필수'),
('스피츠', 'Spitz', '소형', 13, '활발하고 독립적. 피부 질환, 슬개골 탈구 주의'),
('요크셔테리어', 'Yorkshire Terrier', '소형', 14, '용감하고 애교 많음. 기관 허탈, 치아 문제 주의'),
('샤페이', 'Shar Pei', '중형', 11, '독립적이고 충성스러움. 피부 주름 염증, 눈 질환 주의'),
('아키타', 'Akita', '대형', 11, '충성심 강하고 독립적. 자가면역 질환, 고관절 주의'),
('사모예드', 'Samoyed', '중형', 13, '온순하고 사교적. 당뇨, 갑상선 질환 주의'),
('믹스견(소형)',  'Mixed (Small)',  '소형', 14, '다양한 혈통이 섞인 소형 반려견. 일반적으로 건강한 편이나 부모 견종의 성향을 따를 수 있음'),
('믹스견(중형)',  'Mixed (Medium)', '중형', 13, '다양한 혈통이 섞인 중형 반려견. 활동량과 성격은 개체차가 큼'),
('믹스견(대형)',  'Mixed (Large)',  '대형', 11, '다양한 혈통이 섞인 대형 반려견. 충분한 운동과 공간이 필요'),
('미니어처 슈나우저', 'Miniature Schnauzer', '소형', 14, '활발하고 영리함. 고지혈증, 췌장염, 결석 주의'),
('코카스파니엘',  'Cocker Spaniel', '중형', 13, '온순하고 사람을 좋아함. 외이염, 백내장 주의'),
('잭러셀테리어',  'Jack Russell Terrier', '소형', 14, '에너지 넘치고 영리함. 충분한 운동 필요. 슬개골·눈 질환 주의'),
('보스턴테리어',  'Boston Terrier', '소형', 13, '친근하고 적응력 좋음. 단두종 호흡기·각막 질환 주의'),
('시바이누',      'Shiba Inu', '소형', 14, '독립적이고 깔끔함. 알레르기·슬개골 주의')
on conflict do nothing;

-- 고양이 (species=cat)
insert into public.breeds (name_ko, name_en, size_category, avg_lifespan, characteristics, species) values
('코리안 숏헤어', 'Korean Shorthair', '소형', 16, '한국 대표 고양이. 튼튼하고 적응력이 좋음. 비만·요로질환 주의', 'cat'),
('페르시안',     'Persian',          '소형', 15, '온순하고 조용함. 다묘종 장모. 다낭성 신장질환(PKD)·눈물·호흡기 주의', 'cat'),
('러시안 블루',  'Russian Blue',     '소형', 16, '얌전하고 영리함. 비교적 건강하나 비만 주의', 'cat'),
('스코티시 폴드', 'Scottish Fold',   '소형', 14, '접힌 귀가 특징. 골연골이형성증(관절) 주의 필요', 'cat'),
('뱅갈',         'Bengal',           '중형', 15, '활동량이 매우 많고 영리함. 비대성 심근증(HCM) 주의', 'cat'),
('먼치킨',       'Munchkin',         '소형', 14, '짧은 다리가 특징. 척추·관절 부담 주의', 'cat'),
('샴',           'Siamese',          '소형', 16, '사교적이고 말이 많음. 사시·호흡기·치주 질환 주의', 'cat'),
('아메리칸 숏헤어', 'American Shorthair', '소형', 16, '온순하고 건강한 편. 비만·심근증 주의', 'cat'),
('노르웨이 숲',  'Norwegian Forest', '중형', 15, '크고 튼튼한 장모종. 심근증·고관절 이형성 주의', 'cat'),
('랙돌',         'Ragdoll',          '중형', 15, '크고 온순함. 비대성 심근증(HCM) 주의', 'cat'),
('메인쿤',       'Maine Coon',       '대형', 13, '대형 장모종. 비대성 심근증·고관절 이형성·다낭신 주의', 'cat'),
('브리티시 숏헤어', 'British Shorthair', '소형', 15, '차분하고 독립적. 비만·심근증 주의', 'cat'),
('믹스묘',       'Mixed (Cat)',      '소형', 16, '다양한 혈통이 섞인 고양이. 일반적으로 건강한 편', 'cat')
on conflict do nothing;

end if;
end $$;

-- ── 02.7_data/food_items.sql ──
-- food_items : 음식 항목 마스터 시드 (안전도는 food_safety 가 종별로 관리)
insert into public.food_items (name_ko, category) values
('닭가슴살', '육류'),
('삶은 달걀', '육류'),
('익힌 소고기', '육류'),
('익힌 연어', '육류'),
('가공육(햄·소시지)', '육류'),
('당근', '채소'),
('브로콜리', '채소'),
('단호박', '채소'),
('양파', '채소'),
('감자', '채소'),
('고구마', '채소'),
('오이', '채소'),
('껍질콩(그린빈)', '채소'),
('셀러리', '채소'),
('마늘', '채소'),
('부추', '채소'),
('옥수수', '채소'),
('토마토', '채소'),
('블루베리', '과일'),
('포도', '과일'),
('아보카도', '과일'),
('사과', '과일'),
('바나나', '과일'),
('수박', '과일'),
('딸기', '과일'),
('건포도', '과일'),
('우유', '유제품'),
('플레인 요거트', '유제품'),
('치즈', '유제품'),
('초콜릿', '기타'),
('자일리톨', '기타'),
('마카다미아 너트', '기타'),
('땅콩버터', '기타'),
('익힌 흰쌀', '기타'),
('커피·카페인', '기타'),
('호두', '기타'),
('알코올', '기타'),
('생이스트 반죽', '기타'),
('아몬드', '기타')
on conflict (name_ko) do nothing;

-- ── 02.7_data/food_safety.sql ──
-- food_safety : 음식별·종별 안전도 시드 (개/고양이)
-- 강아지(dog)
insert into public.food_safety (food_id, species, safety_level, reason, caution, source)
select fi.id, 'dog', v.lvl, v.reason, v.caution, v.src
from (values
  ('닭가슴살',   'safe',      '고단백 저지방으로 강아지에게 매우 좋은 식재료', '반드시 익혀서 주세요. 뼈는 제거하세요', 'AKC'),
  ('당근',       'safe',      '베타카로틴과 섬유질이 풍부하고 칼로리가 낮음', null, 'AKC'),
  ('브로콜리',   'safe',      '비타민과 미네랄이 풍부. 소량만 급여 권장', '너무 많이 주면 소화 장애 유발 가능', 'AKC'),
  ('블루베리',   'safe',      '항산화 성분이 풍부하고 저칼로리', null, 'AKC'),
  ('단호박',     'safe',      '섬유질이 풍부해 소화에 좋음', null, 'AKC'),
  ('삶은 달걀',  'safe',      '단백질과 지방산이 풍부', '생달걀 흰자는 피하세요 (아비딘 성분)', 'AKC'),
  ('포도',       'dangerous', '신부전을 유발할 수 있는 독성 물질 포함', '씨 없는 포도, 건포도 모두 위험', 'ASPCA'),
  ('양파',       'dangerous', '적혈구를 파괴하는 유기황 화합물 포함. 빈혈 유발', '익혀도 위험. 소량이라도 금지', 'ASPCA'),
  ('초콜릿',     'dangerous', '테오브로민 성분이 심장, 신경계에 독성', '다크 초콜릿이 특히 위험', 'ASPCA'),
  ('자일리톨',   'dangerous', '저혈당 및 급성 간부전 유발 가능', '껌, 과자 성분표 반드시 확인', 'ASPCA'),
  ('마카다미아 너트', 'dangerous', '근육 약화, 발열, 구토 유발', null, 'ASPCA'),
  ('아보카도',   'dangerous', '퍼신 성분이 구토, 설사 유발', null, 'ASPCA'),
  ('우유',       'caution',   '성견은 유당분해효소 부족으로 소화 어려움', '소화 장애 증상 보이면 즉시 중단', 'ASPCA'),
  ('땅콩버터',   'caution',   '단백질 풍부하나 고칼로리. 자일리톨 없는 제품만', '자일리톨 함유 제품은 절대 금지', 'AKC'),
  ('감자',       'caution',   '익힌 감자는 괜찮으나 생감자, 싹난 감자는 위험', '튀긴 감자(감자칩)는 염분과 지방 과다', 'AKC'),
  ('사과',       'safe',      '비타민 A·C와 섬유질이 풍부', '씨와 씨방은 시안화물 위험이 있어 제거하세요', 'AKC'),
  ('바나나',     'safe',      '칼륨·비타민이 풍부한 저칼로리 간식', '당분이 높아 소량만 급여하세요', 'AKC'),
  ('수박',       'safe',      '수분이 많아 더운 날 수분 보충에 좋음', '씨와 껍질은 장폐색 위험이 있어 반드시 제거하세요', 'AKC'),
  ('딸기',       'safe',      '비타민 C와 항산화 성분이 풍부', '당분이 있어 소량만 급여하세요', 'AKC'),
  ('고구마',     'safe',      '식이섬유와 베타카로틴이 풍부', '반드시 익혀서 껍질 없이 소량 급여하세요', 'AKC'),
  ('오이',       'safe',      '저칼로리 고수분으로 체중 관리 간식에 적합', '한입 크기로 잘라 급여하세요', 'ASPCA'),
  ('껍질콩(그린빈)', 'safe',  '저칼로리에 포만감을 주어 다이어트 간식에 좋음', '양념 없이 익히거나 생으로 급여하세요', 'AKC'),
  ('셀러리',     'safe',      '저칼로리에 비타민이 풍부', '한입 크기로 잘라 질식을 예방하세요', 'AKC'),
  ('익힌 소고기', 'safe',     '양질의 단백질 공급원', '기름기 적은 부위를 양념 없이 익혀 주세요', 'AKC'),
  ('익힌 연어',  'safe',      '오메가-3 지방산이 풍부해 피부·털에 좋음', '반드시 완전히 익히고 뼈를 제거하세요. 생연어는 기생충 위험', 'AKC'),
  ('플레인 요거트', 'safe',   '프로바이오틱스가 장 건강에 도움', '무가당·자일리톨 무첨가 제품만. 유당 불내성이면 중단하세요', 'AKC'),
  ('익힌 흰쌀',  'safe',      '소화가 잘 되어 위장이 약할 때 도움', '양념 없이 소량 급여하세요', 'AKC'),
  ('마늘',       'dangerous', '양파와 같은 유기황 화합물로 적혈구를 파괴해 빈혈 유발', '익혀도 위험하며 소량이라도 금지', 'ASPCA'),
  ('부추',       'dangerous', '파속 식물로 적혈구 손상·빈혈을 유발', '소량이라도 급여 금지', 'ASPCA'),
  ('건포도',     'dangerous', '포도와 동일하게 급성 신부전을 유발', '극소량도 위험', 'ASPCA'),
  ('커피·카페인', 'dangerous', '메틸잔틴 성분이 심장·신경계에 독성', '커피·차·에너지드링크 모두 위험', 'ASPCA'),
  ('호두',       'dangerous', '곰팡이 독소와 높은 지방으로 신경 증상·췌장염 위험', '소량도 피하세요', 'ASPCA'),
  ('알코올',     'dangerous', '소량으로도 구토·호흡곤란·혼수에 이를 수 있음', '술·알코올 함유 음식 모두 절대 금지', 'ASPCA'),
  ('생이스트 반죽', 'dangerous', '위에서 팽창하고 알코올을 생성해 매우 위험', '베이킹 전 반죽에 접근하지 못하게 하세요', 'ASPCA'),
  ('치즈',       'caution',   '단백질·칼슘이 있으나 고지방·유당으로 소화 부담', '저지방 무염 제품을 아주 소량만. 설사 시 중단', 'AKC'),
  ('옥수수',     'caution',   '알맹이는 소량 급여 가능하나 영양가는 낮음', '옥수수 속대는 장폐색 위험이 크므로 절대 금지', 'AKC'),
  ('토마토',     'caution',   '잘 익은 열매 과육은 소량 가능', '덜 익은 열매·줄기·잎은 솔라닌 독성이 있어 금지', 'AKC'),
  ('아몬드',     'caution',   '소화가 어렵고 고지방이라 췌장염·기도 막힘 위험', '권장하지 않음. 소금 간 제품은 금지', 'ASPCA/AKC'),
  ('가공육(햄·소시지)', 'caution', '염분·지방·보존료가 많아 비만·췌장염·나트륨 부담', '되도록 피하고 줄 경우 아주 소량', 'ASPCA/AKC')
) as v(name_ko, lvl, reason, caution, src)
join public.food_items fi on fi.name_ko = v.name_ko
on conflict (food_id, species) do nothing;

-- 고양이(cat)
insert into public.food_safety (food_id, species, safety_level, reason, caution, source)
select fi.id, 'cat', v.lvl, v.reason, v.caution, 'ASPCA'
from (values
  ('양파',       'dangerous', '고양이는 개보다 양파류에 더 민감하며 적혈구를 파괴해 빈혈을 유발', '익혀도 위험. 소량도 금지'),
  ('마늘',       'dangerous', '양파보다 독성이 강한 파속 식물. 고양이에게 특히 위험', '소량도 금지'),
  ('부추',       'dangerous', '파속 식물로 고양이 적혈구 손상·빈혈 유발', '소량도 금지'),
  ('초콜릿',     'dangerous', '테오브로민이 심장·신경계에 독성', '모든 종류 위험'),
  ('커피·카페인', 'dangerous', '메틸잔틴 성분이 심장·신경계에 독성', '커피·차·에너지드링크 모두 위험'),
  ('포도',       'dangerous', '신장 손상 위험이 보고됨', '소량도 피하세요'),
  ('건포도',     'dangerous', '포도와 동일하게 신장 손상 위험', '소량도 피하세요'),
  ('자일리톨',   'dangerous', '저혈당·간 손상 유발 가능', '껌·과자 성분표 확인'),
  ('마카다미아 너트', 'dangerous', '신경 증상 유발 가능', '소량도 피하세요'),
  ('알코올',     'dangerous', '소량으로도 구토·호흡곤란·혼수에 이를 수 있음', '절대 금지'),
  ('아보카도',   'dangerous', '퍼신 성분이 위장 장애를 유발할 수 있음', '피하세요'),
  ('우유',       'caution',   '대부분의 성묘는 유당불내성으로 설사를 일으킴', '고양이 전용 우유가 아니면 피하세요'),
  ('치즈',       'caution',   '유당·고지방으로 소화 부담', '아주 소량만, 설사 시 중단'),
  ('닭가슴살',   'safe',      '육식동물인 고양이에게 좋은 단백질 공급원', '반드시 익히고 뼈·양념 없이 주세요'),
  ('익힌 소고기', 'safe',     '양질의 동물성 단백질', '기름기 적은 부위를 양념 없이 익혀 주세요'),
  ('익힌 연어',  'safe',      '오메가-3가 풍부해 피부·털에 도움', '반드시 완전히 익히세요. 생연어는 티아민 파괴로 신경 문제 위험'),
  ('삶은 달걀',  'safe',      '단백질이 풍부', '완전히 익혀서 소량 급여하세요'),
  ('단호박',     'safe',      '식이섬유가 풍부해 소화·헤어볼 관리에 도움', '익혀서 소량만'),
  ('블루베리',   'safe',      '항산화 성분이 있는 간식', '아주 소량만. 고양이는 단맛을 느끼지 못함')
) as v(name_ko, lvl, reason, caution)
join public.food_items fi on fi.name_ko = v.name_ko
on conflict (food_id, species) do nothing;

-- 고양이(cat) 추가 (016)
insert into public.food_safety (food_id, species, safety_level, reason, caution, source)
select fi.id, 'cat', v.lvl, v.reason, v.caution, 'ASPCA'
from (values
  ('사과',        'safe',      '소량의 과육은 안전한 간식', '씨·심 제거, 아주 소량만(고양이는 단맛을 못 느낌)'),
  ('바나나',      'safe',      '소량은 안전', '당분이 높아 아주 소량만'),
  ('수박',        'safe',      '수분 보충 간식', '씨·껍질 제거, 소량만'),
  ('딸기',        'safe',      '소량은 안전', '아주 소량만'),
  ('고구마',      'caution',   '소량 익힌 것은 가능하나 탄수화물 위주라 필수 아님', '익혀서 아주 소량만'),
  ('오이',        'safe',      '수분 많은 저칼로리 간식', '얇게 소량만'),
  ('플레인 요거트','caution',  '대부분 유당불내성이라 소화 부담', '아주 소량, 설사 시 중단'),
  ('호두',        'dangerous', '기름기·곰팡이 독소로 위장·신경 증상 위험', '주지 마세요'),
  ('아몬드',      'caution',   '고지방으로 위장 장애 가능', '권장하지 않음'),
  ('가공육(햄·소시지)', 'caution', '염분·지방·첨가물 과다', '되도록 피하세요')
) as v(name_ko, lvl, reason, caution)
join public.food_items fi on fi.name_ko = v.name_ko
on conflict (food_id, species) do nothing;

-- ── 02.7_data/health_guides.sql ──
-- health_guides : 시드 데이터 (테이블이 비어있을 때만 삽입 → 재실행 안전)
do $$
begin
if not exists (select 1 from public.health_guides) then

-- health_guides : 건강 가이드 시드 (공통/크기별/견종별 + 고양이)
-- 공통 (강아지 species 기본값)
insert into public.health_guides (breed_id, size_category, age_month_min, age_month_max, category, title, description) values
(null, null, 0,  12,  '백신', '기초 예방접종', '생후 6~8주부터 종합백신(DHPPL) 3차, 코로나 2차, 광견병 1차를 완료하세요.'),
(null, null, 0,  12,  '검진', '구충 및 심장사상충 예방', '생후 2개월부터 심장사상충 예방약을 매월 투여하세요. 내부 구충은 3개월마다 권장합니다.'),
(null, null, 6,  11,  '중성화', '중성화 수술 적기 안내', '대부분 소형견은 생후 6개월, 대형견은 12~18개월 전후가 적기입니다. 수의사와 상담 후 결정하세요.'),
(null, null, 12, 84,  '검진', '연 1회 정기 검진', '혈액검사, 소변검사, 방사선 촬영을 포함한 기본 건강검진을 매년 받으세요.'),
(null, null, 12, 84,  '검진', '심장사상충 연간 검사', '매년 심장사상충 항원 검사를 받고 예방약을 지속 투여하세요.'),
(null, null, 84, 240, '검진', '시니어 반기 검진', '7세 이상은 6개월마다 검진을 권장합니다. 신장·간·심장 기능을 집중 체크하세요.'),
(null, null, 84, 240, '질환', '시니어 주요 질환 모니터링', '관절염·백내장·치주 질환·종양이 흔합니다. 식욕 저하·활동 감소 등 행동 변화에 주의하세요.')
on conflict do nothing;

-- 대형견 공통(크기별): 고관절
insert into public.health_guides (breed_id, size_category, age_month_min, age_month_max, category, title, description) values
(null, '대형', 12, 240, '질환', '고관절 이형성증 관리', '대형견은 고관절 이형성증 위험이 큽니다. 과체중을 피하고 미끄러운 바닥에 주의하세요.')
on conflict do nothing;

-- 견종별 질환
insert into public.health_guides (breed_id, size_category, age_month_min, age_month_max, category, title, description)
select b.id, null, v.amin, v.amax, v.cat, v.title, v.descr
from (values
  ('말티즈',            12, 240, '질환', '슬개골 탈구 주의', '슬개골 탈구 발생률이 높습니다. 점프·계단을 줄이고 뒷다리를 절뚝거리면 즉시 검진받으세요.'),
  ('말티즈',            12, 240, '질환', '기관 허탈 관리', '거위 울음 같은 기침을 하면 기관 허탈을 의심하세요. 목줄 대신 하네스를 사용하세요.'),
  ('말티즈',            60, 240, '질환', '백내장 정기 검진', '5세 이상은 백내장 위험이 높아집니다. 연 1회 안과 검진을 받으세요.'),
  ('푸들(토이)',        12, 240, '질환', '진행성 망막 위축 주의', '유전성 눈 질환(PRA) 위험이 있습니다. 야간 시력 저하가 보이면 즉시 검진받으세요.'),
  ('푸들(토이)',        12, 240, '검진', '치아 관리', '치주 질환이 흔합니다. 주 3회 이상 양치하고 연 1회 스케일링을 받으세요.'),
  ('닥스훈트',          12, 240, '질환', '척추 디스크 질환(IVDD)', '척추 디스크 질환 발생률이 매우 높습니다. 점프 금지·경사로 설치를 하고, 갑작스러운 보행 장애는 응급상황입니다.'),
  ('닥스훈트',          12, 240, '질환', '비만 관리 필수', '비만이 척추에 큰 부담을 줍니다. 정기적으로 체중을 측정하고 권장 체중을 유지하세요.'),
  ('프렌치불독',        12, 240, '질환', '호흡기 관리(BOAS)', '단두종 기도 증후군으로 호흡 곤란이 올 수 있습니다. 더위·흥분·과격한 운동을 피하세요.'),
  ('프렌치불독',        12, 240, '질환', '척추 기형 주의', '스크류 테일 구조로 척추 기형이 생길 수 있습니다. 보행 이상이 보이면 즉시 검진받으세요.'),
  ('골든 리트리버',     12, 240, '질환', '종양(암) 정기 검진', '종양 발생률이 높습니다. 3세 이후 연 1회 종합 혈액검사와 신체검진을 받으세요.'),
  ('래브라도 리트리버', 12, 240, '질환', '비만 관리', '식욕이 왕성해 비만이 되기 쉽습니다. 간식을 줄이고 정량 급식을 유지하세요.'),
  ('시베리안 허스키',   12, 240, '질환', '눈 질환 정기 검진', '백내장·PRA·녹내장 발생률이 높습니다. 연 1회 안과 검진을 권장합니다.'),
  ('시베리안 허스키',   12, 240, '질환', '여름철 온도 관리', '이중모로 더위에 약합니다. 여름철 활동은 시원한 시간대에 하고 물·그늘을 충분히 제공하세요.'),
  ('비글',              12, 240, '질환', '비만 및 척추 주의', '식욕이 강해 비만이 쉽게 옵니다. 체중 증가는 척추에 부담을 주니 정기 측정하세요.'),
  ('비글',              12, 240, '질환', '귀 관리', '귀가 늘어져 외이염에 걸리기 쉽습니다. 주 1회 귀 청소를 해주세요.'),
  ('보더콜리',          12, 240, '질환', '눈 질환(CEA)', '콜리 눈 이상(CEA) 유전 질환이 있습니다. 정기 안과 검진을 받으세요.'),
  ('보더콜리',          12, 240, '질환', '정신적 자극 필요', '지능이 높아 자극 부족 시 강박행동·분리불안을 보일 수 있습니다. 두뇌 훈련이 필수입니다.'),
  ('포메라니안',        12, 240, '질환', '탈모 증후군(BSD) 주의', '블랙 스킨 디지즈(BSD) 탈모 질환이 있습니다. 털이 비정상적으로 빠지면 검진받으세요.'),
  ('포메라니안',        12, 240, '질환', '기관 허탈 주의', '기관 허탈이 흔합니다. 목줄보다 하네스를 쓰고 흥분 상태를 최소화하세요.'),
  ('시츄',              12, 240, '질환', '안구 돌출 및 각막 손상', '눈이 돌출되어 각막 손상이 잦습니다. 눈 분비물을 매일 닦고 충혈 시 검진받으세요.'),
  ('치와와',            0,  11,  '질환', '저혈당 주의(퍼피)', '강아지는 저혈당에 취약합니다. 소량씩 자주 급식하고 무기력·떨림·경련 시 즉시 병원으로 가세요.'),
  ('치와와',            12, 240, '질환', '수두증(뇌수종) 주의', '두개골이 작아 수두증 위험이 있습니다. 비정상 보행·경련·눈 이상이 보이면 즉시 검진받으세요.'),
  ('아키타',            12, 240, '질환', '자가면역 질환 주의', '자가면역 질환(VKH 증후군 등) 발생률이 있습니다. 눈 색소·피부 변화가 보이면 검진받으세요.'),
  ('진돗개',            12, 240, '질환', '비교적 건강하나 정기 검진 필수', '비교적 건강하지만 연 1회 기본 혈액검사와 심장사상충 검사는 반드시 받으세요.')
) as v(breed_ko, amin, amax, cat, title, descr)
join public.breeds b on b.name_ko = v.breed_ko
on conflict do nothing;

-- 고양이 건강 가이드 (species=cat)
insert into public.health_guides (breed_id, size_category, species, age_month_min, age_month_max, category, title, description) values
(null, null, 'cat', 0,  12,  '백신', '기초 예방접종', '생후 6~8주부터 종합백신(FVRCP) 2~3차, 광견병 접종을 완료하세요. 실내묘도 기본 접종을 권장합니다.'),
(null, null, 'cat', 0,  12,  '검진', '구충 및 기생충 예방', '생후 초기부터 내·외부 구충을 시작하세요. 분변 검사로 기생충 감염 여부를 확인하세요.'),
(null, null, 'cat', 4,  8,   '중성화', '중성화 수술 적기', '생후 4~6개월 전후가 일반적인 중성화 시기입니다. 행동 문제·생식기 질환 예방에 도움이 됩니다.'),
(null, null, 'cat', 12, 84,  '검진', '연 1회 정기 검진', '체중·치아·신장 수치를 포함한 기본 검진을 매년 받으세요.'),
(null, null, 'cat', 12, 240, '질환', '하부 요로기 질환(FLUTD) 주의', '고양이는 방광염·요로결석이 흔합니다. 충분한 음수와 화장실 청결을 유지하고, 배뇨 곤란 시 즉시 병원으로 가세요(특히 수컷은 응급).'),
(null, null, 'cat', 84, 240, '검진', '시니어 신장 검진', '7세 이상 고양이는 만성 신부전이 흔합니다. 6개월~1년마다 신장 수치와 혈압을 검사하세요.'),
(null, null, 'cat', 12, 240, '질환', '헤어볼·구강 관리', '규칙적인 빗질로 헤어볼을 줄이고, 치주 질환 예방을 위해 양치·검진을 병행하세요.')
on conflict do nothing;

end if;
end $$;

-- ── 02.7_data/walk_guides.sql ──
-- walk_guides : 시드 데이터 (테이블이 비어있을 때만 삽입 → 재실행 안전)
do $$
begin
if not exists (select 1 from public.walk_guides) then

-- walk_guides : 활동 가이드 시드 (산책/놀이/훈련, 강아지+고양이)
-- (1) 공통: 나이 기반 산책 (size/breed 무관)
insert into public.walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips, activity_type) values
(null, null, 0,  5,  10, '가벼움', '생후 5개월 미만은 짧게 여러 번 나눠 산책하세요. 뼈와 관절이 아직 약합니다.', '산책'),
(null, null, 6,  11, 20, '가벼움', '예방접종 완료 후 외부 산책을 시작하고, 하루 2회로 나눠 걸으세요.', '산책'),
(null, null, 84, 240,20, '가벼움', '시니어견은 무리하지 않게 천천히, 평탄한 길 위주로 산책하세요. 절뚝거림 등 관절 통증 징후에 주의하세요.', '산책')
on conflict do nothing;

-- (2) 크기별: 성견 산책
insert into public.walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips, activity_type) values
(null, '소형', 12, 83, 30, '보통', '하루 30분 내외가 적당합니다. 더운 날 아스팔트 열기로 인한 발바닥 화상에 주의하세요.', '산책'),
(null, '중형', 12, 83, 60, '활발', '하루 1시간 내외의 활발한 운동이 필요합니다. 공놀이·수영 등 다양한 활동을 함께 해주세요.', '산책'),
(null, '대형', 12, 83, 80, '활발', '하루 80분 이상 충분한 운동이 필요합니다. 관절 보호를 위해 운동 전후 스트레칭을 해주세요.', '산책')
on conflict do nothing;

-- (3) 견종별 예외(성견) 산책
insert into public.walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips, activity_type)
select b.id, null, 12, 83, 25, '가벼움', '척추 디스크 보호를 위해 점프·계단을 피하고, 하루 2회 15분씩 평지 위주로 산책하세요.', '산책'
from public.breeds b where b.name_ko = '닥스훈트' on conflict do nothing;
insert into public.walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips, activity_type)
select b.id, null, 12, 83, 50, '활발', '목양견 출신으로 활동량이 많습니다. 하루 50분 이상 운동시키고 비만을 예방하세요.', '산책'
from public.breeds b where b.name_ko = '웰시코기' on conflict do nothing;
insert into public.walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips, activity_type)
select b.id, null, 12, 83, 60, '활발', '활동적이고 독립적입니다. 넓은 공간에서 충분히 뛰게 해주고 리드줄을 꼭 착용하세요.', '산책'
from public.breeds b where b.name_ko = '진돗개' on conflict do nothing;
insert into public.walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips, activity_type)
select b.id, null, 12, 83, 90, '활발', '운동량이 매우 많은 견종입니다. 하루 최소 90분 이상 운동이 필요하며, 부족하면 파괴적 행동을 보일 수 있습니다.', '산책'
from public.breeds b where b.name_ko in ('시베리안 허스키', '사모예드') on conflict do nothing;
insert into public.walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips, activity_type)
select b.id, null, 12, 83, 25, '가벼움', '단두종으로 호흡기가 약합니다. 더운 날씨·격렬한 운동을 피하고 시원한 시간대에 짧게 산책하세요.', '산책'
from public.breeds b where b.name_ko = '프렌치불독' on conflict do nothing;

-- (4) 고양이 사냥놀이 (006 시드 → 008에서 activity_type='사냥놀이')
insert into public.walk_guides (breed_id, size_category, species, age_month_min, age_month_max, daily_minutes, intensity, tips, activity_type) values
(null, null, 'cat', 0,  11,  30, '활발', '새끼 고양이는 에너지가 넘칩니다. 낚싯대 장난감 등으로 하루 여러 번 짧게 사냥 놀이를 해주세요.', '사냥놀이'),
(null, null, 'cat', 12, 83,  20, '보통', '하루 2회, 10분 내외의 사냥 놀이로 운동시키세요. 캣타워·수직 공간으로 활동량을 보충하면 좋습니다.', '사냥놀이'),
(null, null, 'cat', 84, 240, 15, '가벼움', '시니어 고양이는 무리하지 않게 가벼운 놀이를 짧게 하세요. 관절 부담이 적은 낮은 동선을 마련해주세요.', '사냥놀이')
on conflict do nothing;

-- (5) 강아지 실내놀이
insert into public.walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips) values
(null, null, 'dog', 0, 11, '실내놀이', 20, '활발', '공놀이·터그놀이를 짧게 자주 반복하세요. 관절이 발달 중이니 점프·계단은 자제하고, 폭신한 바닥에서 놀아주세요.'),
(null, null, 'dog', 12, 83, '실내놀이', 20, '보통', '공던지기, 숨바꼭질, 터그놀이 등으로 실내에서도 충분히 운동할 수 있어요. 날씨가 나쁜 날 특히 유용해요.'),
(null, null, 'dog', 84, 240, '실내놀이', 15, '가벼움', '시니어 강아지는 짧은 놀이를 여러 번 나누세요. 관절 부담이 적은 부드러운 장난감을 활용하고, 무리한 점프는 피하세요.'),
(null, '소형', 'dog', 12, 83, '실내놀이', 15, '보통', '소형견은 슬개골 탈구를 주의하세요. 낮은 점프 위주의 놀이와 미끄럼 방지 매트를 깔아주는 것이 좋아요.')
on conflict do nothing;

-- (6) 강아지 인지훈련
insert into public.walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips) values
(null, null, 'dog', 0, 11, '인지훈련', 10, '가벼움', '앉아·기다려·이리와 등 기초 명령어를 짧게 반복하세요. 집중 시간이 짧으니 한 세션은 5분 이내가 효과적이에요. 간식 보상을 활용하세요.'),
(null, null, 'dog', 12, 83, '인지훈련', 15, '보통', '노즈워크(냄새로 간식 찾기), 퍼즐 피더, 클리커 트릭 훈련으로 두뇌를 자극하세요. 정신적 자극은 신체 운동만큼 피로를 줘요.'),
(null, null, 'dog', 84, 240, '인지훈련', 10, '가벼움', '시니어도 인지 자극이 중요해요. 간단한 퍼즐 피더나 냄새 탐색 게임은 인지 기능 유지에 도움이 됩니다.')
on conflict do nothing;

-- (7) 고양이 실내탐험
insert into public.walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips) values
(null, null, 'cat', 0, 11, '실내탐험', 20, '활발', '새끼 고양이는 탐험 욕구가 왕성해요. 박스 미로, 터널 장난감, 캣타워로 수직·수평 공간을 충분히 제공하세요. 새로운 물건을 자주 교체해 호기심을 자극하세요.'),
(null, null, 'cat', 12, 83, '실내탐험', 15, '보통', '캣타워, 창문 해먹, 선반 등 수직 공간이 중요해요. 환경 풍부화(새 박스, 종이백, 캣닙 장난감)는 스트레스 해소에 효과적이에요.'),
(null, null, 'cat', 84, 240, '실내탐험', 10, '가벼움', '시니어 고양이에게는 낮은 캣타워나 계단을 제공해 관절 부담 없이 탐험할 수 있게 해주세요. 따뜻하고 편안한 쉼터도 잊지 마세요.')
on conflict do nothing;

-- (8) 고양이 인지훈련
insert into public.walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips) values
(null, null, 'cat', 0, 11, '인지훈련', 10, '보통', '고양이도 훈련이 가능해요! 클리커로 하이파이브, 이리와를 가르쳐보세요. 짧은 세션과 고가치 간식(참치, 치킨)이 핵심이에요.'),
(null, null, 'cat', 12, 83, '인지훈련', 10, '가벼움', '퍼즐 피더, 숨긴 간식 찾기, 노즈워크로 정신적 자극을 주세요. 밥을 퍼즐 피더로 제공하면 매일 자연스럽게 두뇌 운동이 돼요.'),
(null, null, 'cat', 84, 240, '인지훈련', 10, '가벼움', '간단한 퍼즐 피더로 식사 시간을 놀이로 만들어주세요. 인지 자극은 노화 속도를 늦추고 삶의 질을 높여줘요.')
on conflict do nothing;

-- (9) 견종별 특화 활동
insert into public.walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips)
select b.id, null, 'dog', 12, 83, '실내놀이', 30, '활발', '래브라도는 에너지가 넘쳐요. 공던지기, 수영, 달리기 등 격렬한 운동을 충분히 해줘야 문제 행동을 예방할 수 있어요.'
from public.breeds b where b.name_ko = '래브라도 리트리버' on conflict do nothing;
insert into public.walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips)
select b.id, null, 'dog', 12, 83, '실내놀이', 30, '활발', '골든 리트리버는 공놀이·수영을 매우 좋아해요. 하루 충분한 운동이 비만 예방과 관절 건강에 중요해요.'
from public.breeds b where b.name_ko = '골든 리트리버' on conflict do nothing;
insert into public.walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips)
select b.id, null, 'dog', 12, 83, '인지훈련', 30, '활발', '보더콜리는 세계 최고 지능의 견종이에요. 어질리티, 플라이볼, 고급 트릭 훈련으로 두뇌를 충분히 자극하지 않으면 문제 행동이 생겨요.'
from public.breeds b where b.name_ko = '보더콜리' on conflict do nothing;
insert into public.walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips)
select b.id, null, 'cat', 12, 83, '사냥놀이', 30, '활발', '뱅갈은 에너지가 매우 많아요. 하루 2~3회 격렬한 사냥 놀이가 필수예요. 충분히 놀아주지 않으면 가구를 망가뜨릴 수 있어요.'
from public.breeds b where b.name_ko = '뱅갈' on conflict do nothing;

end if;
end $$;

-- ┌──────────────────────────────────────────────
-- │ 02.8_storage
-- └──────────────────────────────────────────────

-- ── 02.8_storage/storage.sql ──
-- storage : 버킷 생성 + storage.objects 정책 (커뮤니티/아바타/반려동물 사진)

-- 버킷 생성 (public 읽기)
insert into storage.buckets (id, name, public)
values
  ('post-images', 'post-images', true),
  ('avatars',     'avatars',     true),
  ('pet-photos',  'pet-photos',  true)
on conflict (id) do nothing;

-- ── post-images 정책 ──────────────────────────────
drop policy if exists "post_images_read"   on storage.objects;
drop policy if exists "post_images_insert" on storage.objects;
drop policy if exists "post_images_delete" on storage.objects;
create policy "post_images_read" on storage.objects
  for select using (bucket_id = 'post-images');
create policy "post_images_insert" on storage.objects
  for insert with check (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "post_images_delete" on storage.objects
  for delete using (
    bucket_id = 'post-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── avatars 정책 ──────────────────────────────────
drop policy if exists "avatars_read"   on storage.objects;
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── pet-photos 정책 ───────────────────────────────
drop policy if exists "pet_photos_read"   on storage.objects;
drop policy if exists "pet_photos_insert" on storage.objects;
drop policy if exists "pet_photos_update" on storage.objects;
drop policy if exists "pet_photos_delete" on storage.objects;
create policy "pet_photos_read" on storage.objects
  for select using (bucket_id = 'pet-photos');
create policy "pet_photos_insert" on storage.objects
  for insert with check (
    bucket_id = 'pet-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "pet_photos_update" on storage.objects
  for update using (
    bucket_id = 'pet-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "pet_photos_delete" on storage.objects
  for delete using (
    bucket_id = 'pet-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ┌──────────────────────────────────────────────
-- │ 02.9_config
-- └──────────────────────────────────────────────

-- ── 02.9_config/config.sql ──
-- config : Realtime 발행 등록 등 신규 DB 부가 설정
-- notifications 테이블을 Realtime 발행 목록에 추가 (재실행 안전)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
