-- ============================================================
--  004: 가이드 정규화 + food category + 타임스탬프/CHECK 보강
--  Supabase 대시보드 → SQL Editor 에 전체 붙여넣고 실행하세요.
--  (idempotent하게 작성. 가이드 데이터는 마스터성이라 재시드합니다)
--
--  핵심: walk_guides / health_guides 에 적용범위(scope) 도입
--   - breed_id      : 특정 견종 (최우선)
--   - size_category : 크기 그룹(소형/중형/대형)
--   - 둘 다 null     : 전체 공통
--   조회 우선순위: 견종별 > 크기별 > 공통
--  → 기존엔 "소형견 규칙"을 견종마다 복제 저장(3NF 위반)했으나,
--    이제 size_category 1행으로 관리한다.
-- ============================================================

-- ───────────────────────────────────────────────
-- 1. food_items: 분류(category) 추가
-- ───────────────────────────────────────────────
alter table food_items
  add column if not exists category text
  check (category in ('육류','채소','과일','유제품','기타'));

update food_items set category = '육류'   where name_ko in ('닭가슴살','삶은 달걀');
update food_items set category = '채소'   where name_ko in ('당근','브로콜리','단호박','양파','감자');
update food_items set category = '과일'   where name_ko in ('블루베리','포도','아보카도');
update food_items set category = '유제품' where name_ko in ('우유');
update food_items set category = '기타'   where name_ko in ('초콜릿','자일리톨','마카다미아 너트','땅콩버터');

-- ───────────────────────────────────────────────
-- 2. 타임스탬프(created_at/updated_at) 보강
-- ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['breeds','food_items','health_guides','walk_guides','breed_food_rules']
  loop
    execute format('alter table %I add column if not exists created_at timestamptz default now()', t);
    execute format('alter table %I add column if not exists updated_at timestamptz default now()', t);
  end loop;
end $$;

-- updated_at 자동 갱신 트리거
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['breeds','food_items','health_guides','walk_guides','breed_food_rules']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on %1$I', t);
    execute format('create trigger trg_touch_%1$s before update on %1$I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ───────────────────────────────────────────────
-- 3. 가이드에 size_category(scope) 추가 + 범위 제약
-- ───────────────────────────────────────────────
alter table walk_guides
  add column if not exists size_category text
  check (size_category in ('소형','중형','대형'));
alter table health_guides
  add column if not exists size_category text
  check (size_category in ('소형','중형','대형'));

-- breed_id 와 size_category 동시 지정 금지
alter table walk_guides   drop constraint if exists chk_walk_scope;
alter table walk_guides   add  constraint chk_walk_scope
  check (not (breed_id is not null and size_category is not null));
alter table health_guides drop constraint if exists chk_health_scope;
alter table health_guides add  constraint chk_health_scope
  check (not (breed_id is not null and size_category is not null));

-- ───────────────────────────────────────────────
-- 4. 무결성 CHECK 보강
-- ───────────────────────────────────────────────
alter table walk_guides   drop constraint if exists chk_walk_age;
alter table walk_guides   add  constraint chk_walk_age   check (age_month_min <= age_month_max);
alter table walk_guides   drop constraint if exists chk_walk_minutes;
alter table walk_guides   add  constraint chk_walk_minutes check (daily_minutes > 0);
alter table health_guides drop constraint if exists chk_health_age;
alter table health_guides add  constraint chk_health_age check (age_month_min <= age_month_max);
alter table pets          drop constraint if exists chk_pet_weight;
alter table pets          add  constraint chk_pet_weight check (weight_kg is null or weight_kg > 0);

-- ───────────────────────────────────────────────
-- 5. walk_guides 재시드 (정규화: 크기 규칙은 size_category 1행으로)
-- ───────────────────────────────────────────────
delete from walk_guides;

-- (1) 공통: 나이 기반 (size/breed 무관)
insert into walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips) values
(null, null, 0,  5,  10, '가벼움', '생후 5개월 미만은 짧게 여러 번 나눠 산책하세요. 뼈와 관절이 아직 약합니다.'),
(null, null, 6,  11, 20, '가벼움', '예방접종 완료 후 외부 산책을 시작하고, 하루 2회로 나눠 걸으세요.'),
(null, null, 84, 240,20, '가벼움', '시니어견은 무리하지 않게 천천히, 평탄한 길 위주로 산책하세요. 절뚝거림 등 관절 통증 징후에 주의하세요.');

-- (2) 크기별: 성견(12~83개월) — 견종 복제 없이 size_category 1행씩
insert into walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips) values
(null, '소형', 12, 83, 30, '보통', '하루 30분 내외가 적당합니다. 더운 날 아스팔트 열기로 인한 발바닥 화상에 주의하세요.'),
(null, '중형', 12, 83, 60, '활발', '하루 1시간 내외의 활발한 운동이 필요합니다. 공놀이·수영 등 다양한 활동을 함께 해주세요.'),
(null, '대형', 12, 83, 80, '활발', '하루 80분 이상 충분한 운동이 필요합니다. 관절 보호를 위해 운동 전후 스트레칭을 해주세요.');

-- (3) 견종별 예외(성견): 크기 규칙으로 설명 안 되는 경우만
insert into walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, null, 12, 83, 25, '가벼움', '척추 디스크 보호를 위해 점프·계단을 피하고, 하루 2회 15분씩 평지 위주로 산책하세요.'
from breeds b where b.name_ko = '닥스훈트';

insert into walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, null, 12, 83, 50, '활발', '목양견 출신으로 활동량이 많습니다. 하루 50분 이상 운동시키고 비만을 예방하세요.'
from breeds b where b.name_ko = '웰시코기';

insert into walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, null, 12, 83, 60, '활발', '활동적이고 독립적입니다. 넓은 공간에서 충분히 뛰게 해주고 리드줄을 꼭 착용하세요.'
from breeds b where b.name_ko = '진돗개';

insert into walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, null, 12, 83, 90, '활발', '운동량이 매우 많은 견종입니다. 하루 최소 90분 이상 운동이 필요하며, 부족하면 파괴적 행동을 보일 수 있습니다.'
from breeds b where b.name_ko in ('시베리안 허스키', '사모예드');

insert into walk_guides (breed_id, size_category, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, null, 12, 83, 25, '가벼움', '단두종으로 호흡기가 약합니다. 더운 날씨·격렬한 운동을 피하고 시원한 시간대에 짧게 산책하세요.'
from breeds b where b.name_ko = '프렌치불독';

-- ───────────────────────────────────────────────
-- 6. health_guides 재시드 (공통/견종별 — 구조 통일, 질환은 견종별 유지)
-- ───────────────────────────────────────────────
delete from health_guides;

-- 공통
insert into health_guides (breed_id, size_category, age_month_min, age_month_max, category, title, description) values
(null, null, 0,  12,  '백신', '기초 예방접종', '생후 6~8주부터 종합백신(DHPPL) 3차, 코로나 2차, 광견병 1차를 완료하세요.'),
(null, null, 0,  12,  '검진', '구충 및 심장사상충 예방', '생후 2개월부터 심장사상충 예방약을 매월 투여하세요. 내부 구충은 3개월마다 권장합니다.'),
(null, null, 6,  11,  '중성화', '중성화 수술 적기 안내', '대부분 소형견은 생후 6개월, 대형견은 12~18개월 전후가 적기입니다. 수의사와 상담 후 결정하세요.'),
(null, null, 12, 84,  '검진', '연 1회 정기 검진', '혈액검사, 소변검사, 방사선 촬영을 포함한 기본 건강검진을 매년 받으세요.'),
(null, null, 12, 84,  '검진', '심장사상충 연간 검사', '매년 심장사상충 항원 검사를 받고 예방약을 지속 투여하세요.'),
(null, null, 84, 240, '검진', '시니어 반기 검진', '7세 이상은 6개월마다 검진을 권장합니다. 신장·간·심장 기능을 집중 체크하세요.'),
(null, null, 84, 240, '질환', '시니어 주요 질환 모니터링', '관절염·백내장·치주 질환·종양이 흔합니다. 식욕 저하·활동 감소 등 행동 변화에 주의하세요.');

-- 대형견 공통(크기별): 고관절
insert into health_guides (breed_id, size_category, age_month_min, age_month_max, category, title, description) values
(null, '대형', 12, 240, '질환', '고관절 이형성증 관리', '대형견은 고관절 이형성증 위험이 큽니다. 과체중을 피하고 미끄러운 바닥에 주의하세요.');

-- 견종별 질환 (크기 규칙으로 설명 안 되는 유전·품종 특이 질환)
insert into health_guides (breed_id, size_category, age_month_min, age_month_max, category, title, description)
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
join breeds b on b.name_ko = v.breed_ko;
