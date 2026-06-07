-- ============================================================
--  006: 종(species) 지원 — 강아지 + 고양이
--  Supabase 대시보드 → SQL Editor 에 전체 붙여넣고 실행하세요.
--
--  핵심 변경:
--   1) pets/breeds/guides 에 species('dog'|'cat') 도입 (기존 데이터 = dog)
--   2) 음식 안전도를 종별로 분리: food_safety(food_id, species, ...)
--      (같은 음식도 개·고양이 독성이 달라 정규화 분리)
--   3) 고양이 데이터 시드 (묘종 / 음식 안전도 / 건강·활동 가이드)
--
--  음식 독성 출처: ASPCA (고양이는 양파·마늘류에 더 민감, 생선 생식 주의 등)
-- ============================================================

-- ───────────────────────────────────────────────
-- 1. species 컬럼 (기본값 dog → 기존 데이터 보존)
-- ───────────────────────────────────────────────
alter table pets          add column if not exists species text not null default 'dog' check (species in ('dog','cat'));
alter table breeds        add column if not exists species text not null default 'dog' check (species in ('dog','cat'));
alter table health_guides add column if not exists species text not null default 'dog' check (species in ('dog','cat'));
alter table walk_guides   add column if not exists species text not null default 'dog' check (species in ('dog','cat'));

-- ───────────────────────────────────────────────
-- 2. food_safety: 종별 음식 안전도 분리
-- ───────────────────────────────────────────────
create table if not exists public.food_safety (
  id           uuid primary key default gen_random_uuid(),
  food_id      uuid not null references public.food_items(id) on delete cascade,
  species      text not null check (species in ('dog','cat')),
  safety_level text not null check (safety_level in ('safe','caution','dangerous')),
  reason       text,
  caution      text,
  source       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (food_id, species)
);
create index if not exists idx_food_safety_food on public.food_safety (food_id);

alter table public.food_safety enable row level security;
drop policy if exists "food_safety 공개 읽기" on public.food_safety;
create policy "food_safety 공개 읽기" on public.food_safety for select using (true);

drop trigger if exists trg_touch_food_safety on public.food_safety;
create trigger trg_touch_food_safety before update on public.food_safety
  for each row execute function public.touch_updated_at();

-- 기존 food_items 안전도를 dog 기준으로 이전 (한 번만)
insert into public.food_safety (food_id, species, safety_level, reason, caution, source)
select id, 'dog', safety_level, reason, caution, source
from public.food_items
on conflict (food_id, species) do nothing;

-- food_items 슬림화: 안전도 컬럼 제거 (이제 food_safety가 담당)
alter table public.food_items drop column if exists safety_level;
alter table public.food_items drop column if exists reason;
alter table public.food_items drop column if exists caution;
alter table public.food_items drop column if exists source;

-- ───────────────────────────────────────────────
-- 3. 고양이 음식 안전도 (food_safety, species='cat')
--    기존 food_items 재사용. 출처 ASPCA.
-- ───────────────────────────────────────────────
insert into public.food_safety (food_id, species, safety_level, reason, caution, source)
select fi.id, 'cat', v.lvl, v.reason, v.caution, 'ASPCA'
from (values
  -- 위험 (고양이)
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
  -- 주의 (고양이)
  ('우유',       'caution', '대부분의 성묘는 유당불내성으로 설사를 일으킴', '고양이 전용 우유가 아니면 피하세요'),
  ('치즈',       'caution', '유당·고지방으로 소화 부담', '아주 소량만, 설사 시 중단'),
  -- 안전 (고양이, 익혀서 소량)
  ('닭가슴살',   'safe', '육식동물인 고양이에게 좋은 단백질 공급원', '반드시 익히고 뼈·양념 없이 주세요'),
  ('익힌 소고기', 'safe', '양질의 동물성 단백질', '기름기 적은 부위를 양념 없이 익혀 주세요'),
  ('익힌 연어',  'safe', '오메가-3가 풍부해 피부·털에 도움', '반드시 완전히 익히세요. 생연어는 티아민 파괴로 신경 문제 위험'),
  ('삶은 달걀',  'safe', '단백질이 풍부', '완전히 익혀서 소량 급여하세요'),
  ('단호박',     'safe', '식이섬유가 풍부해 소화·헤어볼 관리에 도움', '익혀서 소량만'),
  ('블루베리',   'safe', '항산화 성분이 있는 간식', '아주 소량만. 고양이는 단맛을 느끼지 못함')
) as v(name_ko, lvl, reason, caution)
join public.food_items fi on fi.name_ko = v.name_ko
on conflict (food_id, species) do nothing;

-- ───────────────────────────────────────────────
-- 4. 묘종 (breeds, species='cat')
--    size_category는 개 기준 분류이므로 고양이는 체격 근사값으로 표기
-- ───────────────────────────────────────────────
insert into breeds (name_ko, name_en, size_category, avg_lifespan, characteristics, species) values
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

-- ───────────────────────────────────────────────
-- 5. 고양이 건강 가이드 (health_guides, species='cat')
-- ───────────────────────────────────────────────
insert into health_guides (breed_id, size_category, species, age_month_min, age_month_max, category, title, description) values
(null, null, 'cat', 0,  12,  '백신', '기초 예방접종', '생후 6~8주부터 종합백신(FVRCP) 2~3차, 광견병 접종을 완료하세요. 실내묘도 기본 접종을 권장합니다.'),
(null, null, 'cat', 0,  12,  '검진', '구충 및 기생충 예방', '생후 초기부터 내·외부 구충을 시작하세요. 분변 검사로 기생충 감염 여부를 확인하세요.'),
(null, null, 'cat', 4,  8,   '중성화', '중성화 수술 적기', '생후 4~6개월 전후가 일반적인 중성화 시기입니다. 행동 문제·생식기 질환 예방에 도움이 됩니다.'),
(null, null, 'cat', 12, 84,  '검진', '연 1회 정기 검진', '체중·치아·신장 수치를 포함한 기본 검진을 매년 받으세요.'),
(null, null, 'cat', 12, 240, '질환', '하부 요로기 질환(FLUTD) 주의', '고양이는 방광염·요로결석이 흔합니다. 충분한 음수와 화장실 청결을 유지하고, 배뇨 곤란 시 즉시 병원으로 가세요(특히 수컷은 응급).'),
(null, null, 'cat', 84, 240, '검진', '시니어 신장 검진', '7세 이상 고양이는 만성 신부전이 흔합니다. 6개월~1년마다 신장 수치와 혈압을 검사하세요.'),
(null, null, 'cat', 12, 240, '질환', '헤어볼·구강 관리', '규칙적인 빗질로 헤어볼을 줄이고, 치주 질환 예방을 위해 양치·검진을 병행하세요.')
on conflict do nothing;

-- ───────────────────────────────────────────────
-- 6. 고양이 활동 가이드 (walk_guides, species='cat')
--    고양이는 산책 대신 실내 놀이 중심
-- ───────────────────────────────────────────────
insert into walk_guides (breed_id, size_category, species, age_month_min, age_month_max, daily_minutes, intensity, tips) values
(null, null, 'cat', 0,  11,  30, '활발', '새끼 고양이는 에너지가 넘칩니다. 낚싯대 장난감 등으로 하루 여러 번 짧게 사냥 놀이를 해주세요.'),
(null, null, 'cat', 12, 83,  20, '보통', '하루 2회, 10분 내외의 사냥 놀이로 운동시키세요. 캣타워·수직 공간으로 활동량을 보충하면 좋습니다.'),
(null, null, 'cat', 84, 240, 15, '가벼움', '시니어 고양이는 무리하지 않게 가벼운 놀이를 짧게 하세요. 관절 부담이 적은 낮은 동선을 마련해주세요.')
on conflict do nothing;
