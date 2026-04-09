-- =============================================
-- 1. 테이블 생성
-- =============================================

create table if not exists breeds (
  id uuid primary key default gen_random_uuid(),
  name_ko text not null,
  name_en text,
  size_category text check (size_category in ('소형', '중형', '대형')),
  avg_lifespan int,
  characteristics text
);

create table if not exists pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  breed_id uuid references breeds(id),
  birth_year int not null,
  birth_month int not null check (birth_month between 1 and 12),
  gender text check (gender in ('수컷', '암컷')),
  weight_kg float,
  photo_url text,
  created_at timestamptz default now()
);

create table if not exists food_items (
  id uuid primary key default gen_random_uuid(),
  name_ko text not null unique,
  safety_level text not null check (safety_level in ('safe', 'caution', 'dangerous')),
  reason text,
  caution text
);

create table if not exists breed_food_rules (
  id uuid primary key default gen_random_uuid(),
  breed_id uuid references breeds(id) on delete cascade not null,
  food_id uuid references food_items(id) on delete cascade not null,
  override_safety text not null check (override_safety in ('safe', 'caution', 'dangerous')),
  note text,
  unique(breed_id, food_id)
);

create table if not exists health_guides (
  id uuid primary key default gen_random_uuid(),
  breed_id uuid references breeds(id) on delete cascade,  -- null = 공통
  age_month_min int not null,
  age_month_max int not null,
  category text not null,
  title text not null,
  description text not null
);

create table if not exists walk_guides (
  id uuid primary key default gen_random_uuid(),
  breed_id uuid references breeds(id) on delete cascade,  -- null = 공통
  age_month_min int not null,
  age_month_max int not null,
  daily_minutes int not null,
  intensity text not null check (intensity in ('가벼움', '보통', '활발')),
  tips text
);

-- =============================================
-- 2. Row Level Security (RLS) 설정
-- =============================================

alter table pets enable row level security;

create policy "본인 반려동물만 조회" on pets
  for select using (auth.uid() = user_id);

create policy "본인 반려동물만 등록" on pets
  for insert with check (auth.uid() = user_id);

create policy "본인 반려동물만 수정" on pets
  for update using (auth.uid() = user_id);

create policy "본인 반려동물만 삭제" on pets
  for delete using (auth.uid() = user_id);

-- 공개 읽기 허용 (로그인 없이도 음식/건강/산책 정보 조회 가능)
alter table breeds enable row level security;
alter table food_items enable row level security;
alter table health_guides enable row level security;
alter table walk_guides enable row level security;
alter table breed_food_rules enable row level security;

create policy "breeds 공개 읽기" on breeds for select using (true);
create policy "food_items 공개 읽기" on food_items for select using (true);
create policy "health_guides 공개 읽기" on health_guides for select using (true);
create policy "walk_guides 공개 읽기" on walk_guides for select using (true);
create policy "breed_food_rules 공개 읽기" on breed_food_rules for select using (true);

-- =============================================
-- 3. 샘플 데이터 - 견종
-- =============================================

insert into breeds (name_ko, name_en, size_category, avg_lifespan, characteristics) values
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
('프렌치불독', 'French Bulldog', '소형', 11, '온순하고 적응력 좋음. 호흡기, 척추 주의 필수')
on conflict do nothing;

-- =============================================
-- 4. 샘플 데이터 - 음식
-- =============================================

insert into food_items (name_ko, safety_level, reason, caution) values
('닭가슴살', 'safe', '고단백 저지방으로 강아지에게 매우 좋은 식재료', '반드시 익혀서 주세요. 뼈는 제거하세요'),
('당근', 'safe', '베타카로틴과 섬유질이 풍부하고 칼로리가 낮음', NULL),
('브로콜리', 'safe', '비타민과 미네랄이 풍부. 소량만 급여 권장', '너무 많이 주면 소화 장애 유발 가능'),
('블루베리', 'safe', '항산화 성분이 풍부하고 저칼로리', NULL),
('단호박', 'safe', '섬유질이 풍부해 소화에 좋음', NULL),
('삶은 달걀', 'safe', '단백질과 지방산이 풍부', '생달걀 흰자는 피하세요 (아비딘 성분)'),
('포도', 'dangerous', '신부전을 유발할 수 있는 독성 물질 포함', '씨 없는 포도, 건포도 모두 위험'),
('양파', 'dangerous', '적혈구를 파괴하는 유기황 화합물 포함. 빈혈 유발', '익혀도 위험. 소량이라도 금지'),
('초콜릿', 'dangerous', '테오브로민 성분이 심장, 신경계에 독성', '다크 초콜릿이 특히 위험'),
('자일리톨', 'dangerous', '저혈당 및 급성 간부전 유발 가능', '껌, 과자 성분표 반드시 확인'),
('마카다미아 너트', 'dangerous', '근육 약화, 발열, 구토 유발', NULL),
('아보카도', 'dangerous', '퍼신 성분이 구토, 설사 유발', NULL),
('우유', 'caution', '성견은 유당분해효소 부족으로 소화 어려움', '소화 장애 증상 보이면 즉시 중단'),
('땅콩버터', 'caution', '단백질 풍부하나 고칼로리. 자일리톨 없는 제품만', '자일리톨 함유 제품은 절대 금지'),
('감자', 'caution', '익힌 감자는 괜찮으나 생감자, 싹난 감자는 위험', '튀긴 감자(감자칩)는 염분과 지방 과다')
on conflict do nothing;

-- =============================================
-- 5. 샘플 데이터 - 건강 가이드 (공통)
-- =============================================

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description) values
(NULL, 0, 12, '백신', '기초 예방접종', '생후 6~8주부터 종합백신(DHPPL) 3차, 코로나 2차, 광견병 1차를 완료하세요.'),
(NULL, 0, 12, '검진', '구충 및 심장사상충 예방', '생후 2개월부터 심장사상충 예방약을 매월 투여하세요. 내부 구충은 3개월마다 권장합니다.'),
(NULL, 12, 84, '검진', '연 1회 정기 검진', '혈액검사, 소변검사, 방사선 촬영을 포함한 기본 건강검진을 매년 받으세요.'),
(NULL, 12, 84, '검진', '심장사상충 연간 검사', '매년 심장사상충 항원 검사를 받고 예방약을 지속 투여하세요.'),
(NULL, 84, 240, '검진', '시니어 반기 검진', '7세 이상은 6개월마다 검진을 권장합니다. 신장, 간, 심장 기능을 집중 체크하세요.'),
(NULL, 84, 240, '질환', '시니어 주요 질환 모니터링', '관절염, 백내장, 치주 질환, 종양이 흔합니다. 행동 변화(식욕 저하, 활동 감소)에 주의하세요.')
on conflict do nothing;
