-- ============================================================
--  005: 데이터 확장 + 출처(검증) + 내 아이 기록 기능
--  Supabase 대시보드 → SQL Editor 에 전체 붙여넣고 실행하세요.
--
--  데이터 신뢰성: 위험/안전 판정은 권위 출처(ASPCA, AKC)와 대조했고
--  각 음식에 source 컬럼으로 근거를 남깁니다.
--   - ASPCA: People Foods to Avoid Feeding Your Pets
--   - AKC:   Fruits & Vegetables Dogs Can and Can't Eat
-- ============================================================

-- ───────────────────────────────────────────────
-- 1. food_items: 출처(source) 컬럼 + 기존 데이터 근거 부여
-- ───────────────────────────────────────────────
alter table food_items add column if not exists source text;

update food_items set source = 'ASPCA' where name_ko in
  ('포도','양파','초콜릿','자일리톨','마카다미아 너트','아보카도','우유');
update food_items set source = 'AKC' where name_ko in
  ('닭가슴살','당근','브로콜리','블루베리','단호박','삶은 달걀','땅콩버터','감자');

-- ───────────────────────────────────────────────
-- 2. food_items 확장 (검증된 항목만, source 포함)
-- ───────────────────────────────────────────────
insert into food_items (name_ko, safety_level, reason, caution, category, source) values
-- 안전 (AKC / ASPCA)
('사과',       'safe', '비타민 A·C와 섬유질이 풍부', '씨와 씨방은 시안화물 위험이 있어 제거하세요', '과일', 'AKC'),
('바나나',     'safe', '칼륨·비타민이 풍부한 저칼로리 간식', '당분이 높아 소량만 급여하세요', '과일', 'AKC'),
('수박',       'safe', '수분이 많아 더운 날 수분 보충에 좋음', '씨와 껍질은 장폐색 위험이 있어 반드시 제거하세요', '과일', 'AKC'),
('딸기',       'safe', '비타민 C와 항산화 성분이 풍부', '당분이 있어 소량만 급여하세요', '과일', 'AKC'),
('고구마',     'safe', '식이섬유와 베타카로틴이 풍부', '반드시 익혀서 껍질 없이 소량 급여하세요', '채소', 'AKC'),
('오이',       'safe', '저칼로리 고수분으로 체중 관리 간식에 적합', '한입 크기로 잘라 급여하세요', '채소', 'ASPCA'),
('껍질콩(그린빈)', 'safe', '저칼로리에 포만감을 주어 다이어트 간식에 좋음', '양념 없이 익히거나 생으로 급여하세요', '채소', 'AKC'),
('셀러리',     'safe', '저칼로리에 비타민이 풍부', '한입 크기로 잘라 질식을 예방하세요', '채소', 'AKC'),
('익힌 소고기', 'safe', '양질의 단백질 공급원', '기름기 적은 부위를 양념 없이 익혀 주세요', '육류', 'AKC'),
('익힌 연어',  'safe', '오메가-3 지방산이 풍부해 피부·털에 좋음', '반드시 완전히 익히고 뼈를 제거하세요. 생연어는 기생충 위험', '육류', 'AKC'),
('플레인 요거트', 'safe', '프로바이오틱스가 장 건강에 도움', '무가당·자일리톨 무첨가 제품만. 유당 불내성이면 중단하세요', '유제품', 'AKC'),
('익힌 흰쌀',  'safe', '소화가 잘 되어 위장이 약할 때 도움', '양념 없이 소량 급여하세요', '기타', 'AKC'),
-- 위험 (ASPCA)
('마늘',       'dangerous', '양파와 같은 유기황 화합물로 적혈구를 파괴해 빈혈 유발', '익혀도 위험하며 소량이라도 금지', '채소', 'ASPCA'),
('부추',       'dangerous', '파속 식물로 적혈구 손상·빈혈을 유발', '소량이라도 급여 금지', '채소', 'ASPCA'),
('건포도',     'dangerous', '포도와 동일하게 급성 신부전을 유발', '극소량도 위험', '과일', 'ASPCA'),
('커피·카페인', 'dangerous', '메틸잔틴 성분이 심장·신경계에 독성', '커피·차·에너지드링크 모두 위험', '기타', 'ASPCA'),
('호두',       'dangerous', '곰팡이 독소와 높은 지방으로 신경 증상·췌장염 위험', '소량도 피하세요', '기타', 'ASPCA'),
('알코올',     'dangerous', '소량으로도 구토·호흡곤란·혼수에 이를 수 있음', '술·알코올 함유 음식 모두 절대 금지', '기타', 'ASPCA'),
('생이스트 반죽', 'dangerous', '위에서 팽창하고 알코올을 생성해 매우 위험', '베이킹 전 반죽에 접근하지 못하게 하세요', '기타', 'ASPCA'),
-- 주의
('치즈',       'caution', '단백질·칼슘이 있으나 고지방·유당으로 소화 부담', '저지방 무염 제품을 아주 소량만. 설사 시 중단', '유제품', 'AKC'),
('옥수수',     'caution', '알맹이는 소량 급여 가능하나 영양가는 낮음', '옥수수 속대는 장폐색 위험이 크므로 절대 금지', '채소', 'AKC'),
('토마토',     'caution', '잘 익은 열매 과육은 소량 가능', '덜 익은 열매·줄기·잎은 솔라닌 독성이 있어 금지', '채소', 'AKC')
on conflict (name_ko) do nothing;

-- ───────────────────────────────────────────────
-- 3. breeds 확장 (믹스견 + 인기 견종, 출처: AKC 품종 정보)
-- ───────────────────────────────────────────────
insert into breeds (name_ko, name_en, size_category, avg_lifespan, characteristics) values
('믹스견(소형)',  'Mixed (Small)',  '소형', 14, '다양한 혈통이 섞인 소형 반려견. 일반적으로 건강한 편이나 부모 견종의 성향을 따를 수 있음'),
('믹스견(중형)',  'Mixed (Medium)', '중형', 13, '다양한 혈통이 섞인 중형 반려견. 활동량과 성격은 개체차가 큼'),
('믹스견(대형)',  'Mixed (Large)',  '대형', 11, '다양한 혈통이 섞인 대형 반려견. 충분한 운동과 공간이 필요'),
('미니어처 슈나우저', 'Miniature Schnauzer', '소형', 14, '활발하고 영리함. 고지혈증, 췌장염, 결석 주의'),
('코카스파니엘',  'Cocker Spaniel', '중형', 13, '온순하고 사람을 좋아함. 외이염, 백내장 주의'),
('잭러셀테리어',  'Jack Russell Terrier', '소형', 14, '에너지 넘치고 영리함. 충분한 운동 필요. 슬개골·눈 질환 주의'),
('보스턴테리어',  'Boston Terrier', '소형', 13, '친근하고 적응력 좋음. 단두종 호흡기·각막 질환 주의'),
('시바이누',      'Shiba Inu', '소형', 14, '독립적이고 깔끔함. 알레르기·슬개골 주의')
on conflict do nothing;

-- ───────────────────────────────────────────────
-- 4. weight_logs (체중 기록) — 내 아이 실제 기록
-- ───────────────────────────────────────────────
create table if not exists public.weight_logs (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets(id) on delete cascade,
  weight_kg   float not null check (weight_kg > 0),
  measured_on date not null default current_date,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_weight_logs_pet on public.weight_logs (pet_id, measured_on);

alter table public.weight_logs enable row level security;

-- 본인 반려동물의 기록만 (pets 소유권으로 검사)
drop policy if exists "weight_owner_select" on public.weight_logs;
drop policy if exists "weight_owner_insert" on public.weight_logs;
drop policy if exists "weight_owner_update" on public.weight_logs;
drop policy if exists "weight_owner_delete" on public.weight_logs;
create policy "weight_owner_select" on public.weight_logs for select
  using (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));
create policy "weight_owner_insert" on public.weight_logs for insert
  with check (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));
create policy "weight_owner_update" on public.weight_logs for update
  using (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));
create policy "weight_owner_delete" on public.weight_logs for delete
  using (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));

-- ───────────────────────────────────────────────
-- 5. vaccination_records (접종 기록)
-- ───────────────────────────────────────────────
create table if not exists public.vaccination_records (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references public.pets(id) on delete cascade,
  vaccine_name  text not null,
  vaccinated_on date not null default current_date,
  next_due_on   date,
  clinic        text,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_vacc_pet on public.vaccination_records (pet_id, vaccinated_on);

alter table public.vaccination_records enable row level security;

drop policy if exists "vacc_owner_select" on public.vaccination_records;
drop policy if exists "vacc_owner_insert" on public.vaccination_records;
drop policy if exists "vacc_owner_update" on public.vaccination_records;
drop policy if exists "vacc_owner_delete" on public.vaccination_records;
create policy "vacc_owner_select" on public.vaccination_records for select
  using (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));
create policy "vacc_owner_insert" on public.vaccination_records for insert
  with check (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));
create policy "vacc_owner_update" on public.vaccination_records for update
  using (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));
create policy "vacc_owner_delete" on public.vaccination_records for delete
  using (exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid()));
