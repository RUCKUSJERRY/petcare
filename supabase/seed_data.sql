-- =============================================
-- 견종 추가 (기존 15종 + 5종 추가 = 20종)
-- =============================================
insert into breeds (name_ko, name_en, size_category, avg_lifespan, characteristics) values
('스피츠', 'Spitz', '소형', 13, '활발하고 독립적. 피부 질환, 슬개골 탈구 주의'),
('요크셔테리어', 'Yorkshire Terrier', '소형', 14, '용감하고 애교 많음. 기관 허탈, 치아 문제 주의'),
('샤페이', 'Shar Pei', '중형', 11, '독립적이고 충성스러움. 피부 주름 염증, 눈 질환 주의'),
('아키타', 'Akita', '대형', 11, '충성심 강하고 독립적. 자가면역 질환, 고관절 주의'),
('사모예드', 'Samoyed', '중형', 13, '온순하고 사교적. 당뇨, 갑상선 질환 주의')
on conflict do nothing;

-- =============================================
-- 산책 가이드 데이터 (breed_id null = 공통)
-- =============================================

-- 공통 산책 가이드 (견종 무관)
insert into walk_guides (breed_id, age_month_min, age_month_max, daily_minutes, intensity, tips) values
-- 퍼피 (0~11개월)
(null, 0, 5, 10, '가벼움', '생후 5개월 미만은 하루 10분 이내로 짧게 여러 번 나눠서 산책하세요. 뼈와 관절이 아직 약합니다.'),
(null, 6, 11, 20, '가벼움', '하루 15~20분, 하루 2회로 나눠 산책하세요. 예방접종 완료 후 외부 산책을 시작하세요.'),
-- 성견 (12~83개월)
(null, 12, 83, 40, '보통', '하루 30~40분, 하루 2회 산책을 권장합니다. 규칙적인 운동이 체중 관리와 스트레스 해소에 좋습니다.'),
-- 시니어 (84개월~)
(null, 84, 240, 25, '가벼움', '하루 20~30분, 무리하지 않게 천천히 산책하세요. 관절 부담을 줄이기 위해 평탄한 길을 선택하세요.')
on conflict do nothing;

-- 소형견 특화 산책 가이드 (말티즈, 포메라니안, 치와와, 푸들토이, 시츄, 비숑, 닥스훈트, 웰시코기, 스피츠, 요크셔)
-- 소형견은 공통보다 조금 적게
insert into walk_guides (breed_id, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, 12, 83, 30, '보통',
  '소형견은 하루 30분 내외가 적당합니다. 더운 날씨에는 아스팔트 열기로 발바닥 화상에 주의하세요.'
from breeds b
where b.size_category = '소형' and b.name_ko not in ('닥스훈트', '웰시코기')
on conflict do nothing;

-- 닥스훈트 특화: 척추 보호
insert into walk_guides (breed_id, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, 12, 83, 25, '가벼움',
  '척추 디스크 보호를 위해 점프나 계단을 피하세요. 하루 2회 15분씩 평지 위주로 산책하세요.'
from breeds b where b.name_ko = '닥스훈트'
on conflict do nothing;

-- 웰시코기: 활동량 많음
insert into walk_guides (breed_id, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, 12, 83, 50, '활발',
  '목양견 출신으로 활동량이 많습니다. 하루 50분 이상 충분히 운동시켜 주세요. 비만 예방이 중요합니다.'
from breeds b where b.name_ko = '웰시코기'
on conflict do nothing;

-- 중형견 특화 산책 가이드
insert into walk_guides (breed_id, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, 12, 83, 60, '활발',
  '중형견은 하루 1시간 내외의 활발한 운동이 필요합니다. 공놀이나 수영 등 다양한 활동을 함께 즐겨보세요.'
from breeds b
where b.size_category = '중형' and b.name_ko not in ('진돗개', '시베리안 허스키', '사모예드')
on conflict do nothing;

-- 진돗개: 독립적, 충분한 운동
insert into walk_guides (breed_id, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, 12, 83, 60, '활발',
  '활동량이 많고 독립적입니다. 넓은 공간에서 충분히 뛰어놀 수 있게 해주세요. 리드줄 착용 필수입니다.'
from breeds b where b.name_ko = '진돗개'
on conflict do nothing;

-- 허스키, 사모예드: 운동량 매우 많음
insert into walk_guides (breed_id, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, 12, 83, 90, '활발',
  '운동량이 매우 많은 견종입니다. 하루 최소 90분 이상 운동이 필요하며, 부족하면 파괴적 행동을 보일 수 있습니다.'
from breeds b where b.name_ko in ('시베리안 허스키', '사모예드')
on conflict do nothing;

-- 대형견 특화 산책 가이드
insert into walk_guides (breed_id, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, 12, 83, 80, '활발',
  '대형견은 하루 80분 이상 충분한 운동이 필요합니다. 관절 건강을 위해 운동 전후 스트레칭을 해주세요.'
from breeds b
where b.size_category = '대형' and b.name_ko not in ('프렌치불독')
on conflict do nothing;

-- 프렌치불독: 호흡기 문제로 운동량 제한
insert into walk_guides (breed_id, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, 12, 83, 25, '가벼움',
  '단두종으로 호흡기가 약합니다. 더운 날씨와 격렬한 운동을 피하고, 시원한 시간대에 짧게 산책하세요.'
from breeds b where b.name_ko = '프렌치불독'
on conflict do nothing;

-- 시니어 공통 (모든 견종)
insert into walk_guides (breed_id, age_month_min, age_month_max, daily_minutes, intensity, tips)
select b.id, 84, 240, 20, '가벼움',
  '시니어견은 무리한 운동을 피하고 하루 20분 내외로 천천히 산책하세요. 관절 통증 징후(절뚝거림)에 주의하세요.'
from breeds b
on conflict do nothing;

-- =============================================
-- 건강 가이드 - 견종별 특화 데이터
-- =============================================

-- 말티즈 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '슬개골 탈구 주의', '말티즈는 슬개골 탈구 발생률이 높습니다. 점프나 계단을 자주 오르내리지 않도록 하고, 뒷다리를 절뚝거리면 즉시 검진받으세요.'
from breeds b where b.name_ko = '말티즈' on conflict do nothing;

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '기관 허탈 관리', '기침이 잦거나 거위 울음 소리 같은 기침을 한다면 기관 허탈을 의심하세요. 목줄 대신 하네스를 사용하세요.'
from breeds b where b.name_ko = '말티즈' on conflict do nothing;

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 60, 240, '질환', '백내장 정기 검진', '5세 이상 말티즈는 백내장 발생 위험이 높아집니다. 연 1회 안과 검진을 받으세요.'
from breeds b where b.name_ko = '말티즈' on conflict do nothing;

-- 푸들(토이) 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '진행성 망막 위축 주의', '토이 푸들은 유전성 눈 질환인 진행성 망막 위축(PRA) 발생률이 있습니다. 야간 시력 저하 증상이 보이면 즉시 검진받으세요.'
from breeds b where b.name_ko = '푸들(토이)' on conflict do nothing;

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '검진', '치아 관리', '푸들은 치주 질환이 흔합니다. 주 3회 이상 양치질을 하고 연 1회 스케일링을 받으세요.'
from breeds b where b.name_ko = '푸들(토이)' on conflict do nothing;

-- 닥스훈트 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '척추 디스크 질환(IVDD)', '닥스훈트는 척추 디스크 질환 발생률이 매우 높습니다. 소파나 침대 점프를 금지하고 경사로를 설치해주세요. 갑작스러운 보행 장애는 응급상황입니다.'
from breeds b where b.name_ko = '닥스훈트' on conflict do nothing;

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '비만 관리 필수', '닥스훈트는 비만이 척추에 큰 부담을 줍니다. 정기적으로 체중을 측정하고 권장 체중을 유지하세요.'
from breeds b where b.name_ko = '닥스훈트' on conflict do nothing;

-- 프렌치불독 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '호흡기 관리 (BOAS)', '단두종 기도 증후군(BOAS)으로 호흡 곤란이 올 수 있습니다. 더운 날씨, 흥분 상태, 과격한 운동을 피하세요. 코골이가 심해지면 검진받으세요.'
from breeds b where b.name_ko = '프렌치불독' on conflict do nothing;

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '척추 기형 주의', '나사 꼬리(스크류 테일) 구조로 인해 척추 기형이 발생할 수 있습니다. 보행 이상이 보이면 즉시 검진받으세요.'
from breeds b where b.name_ko = '프렌치불독' on conflict do nothing;

-- 골든 리트리버 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '종양(암) 정기 검진', '골든 리트리버는 다른 견종 대비 종양 발생률이 높습니다. 3세 이후부터는 연 1회 종합 혈액검사와 신체검진을 꼭 받으세요.'
from breeds b where b.name_ko = '골든 리트리버' on conflict do nothing;

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '고관절 이형성증 관리', '대형견에게 흔한 고관절 이형성증 위험이 있습니다. 과체중을 피하고, 미끄러운 바닥에서 주의하세요.'
from breeds b where b.name_ko = '골든 리트리버' on conflict do nothing;

-- 래브라도 리트리버 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '비만 관리', '래브라도는 식욕이 왕성해 비만이 되기 쉽습니다. 간식을 줄이고 정량 급식을 유지하세요. 비만은 관절과 심장에 큰 부담을 줍니다.'
from breeds b where b.name_ko = '래브라도 리트리버' on conflict do nothing;

-- 시베리안 허스키 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '눈 질환 정기 검진', '허스키는 백내장, 진행성 망막 위축, 녹내장 등 눈 질환 발생률이 높습니다. 연 1회 안과 검진을 권장합니다.'
from breeds b where b.name_ko = '시베리안 허스키' on conflict do nothing;

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '여름철 온도 관리', '이중모로 더위에 약합니다. 여름철 야외 활동은 아침/저녁 시원한 시간대에 하고, 충분한 물과 그늘을 제공하세요.'
from breeds b where b.name_ko = '시베리안 허스키' on conflict do nothing;

-- 비글 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '비만 및 척추 주의', '비글은 식욕이 강해 비만이 쉽게 옵니다. 체중 증가는 척추 디스크에 부담을 주므로 정기 체중 측정을 하세요.'
from breeds b where b.name_ko = '비글' on conflict do nothing;

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '귀 관리', '귀가 늘어져 통풍이 잘 안 되어 외이염에 걸리기 쉽습니다. 주 1회 귀 청소를 해주세요.'
from breeds b where b.name_ko = '비글' on conflict do nothing;

-- 보더콜리 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '눈 질환 (CEA)', '보더콜리는 콜리 눈 이상(CEA) 유전 질환이 있습니다. 분양 시 부모견 검사 이력을 확인하고, 정기 안과 검진을 받으세요.'
from breeds b where b.name_ko = '보더콜리' on conflict do nothing;

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '정신적 자극 필요', '보더콜리는 지능이 매우 높아 운동 부족과 자극 부족 시 강박행동, 분리불안을 보일 수 있습니다. 두뇌 훈련과 충분한 활동이 필수입니다.'
from breeds b where b.name_ko = '보더콜리' on conflict do nothing;

-- 포메라니안 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '탈모 증후군(BSD) 주의', '포메라니안은 블랙 스킨 디지즈(BSD)라는 탈모 질환이 있습니다. 털이 비정상적으로 빠지면 즉시 검진받으세요.'
from breeds b where b.name_ko = '포메라니안' on conflict do nothing;

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '기관 허탈 주의', '포메라니안도 기관 허탈이 흔합니다. 목줄보다 하네스를 사용하고 흥분 상태를 최소화하세요.'
from breeds b where b.name_ko = '포메라니안' on conflict do nothing;

-- 시츄 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '안구 돌출 및 각막 손상', '시츄는 눈이 크고 돌출되어 각막 손상이 잦습니다. 눈 분비물을 매일 닦아주고, 눈이 충혈되거나 눈물이 많으면 검진받으세요.'
from breeds b where b.name_ko = '시츄' on conflict do nothing;

-- 치와와 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 0, 11, '질환', '저혈당 주의 (퍼피)', '치와와 강아지는 저혈당에 취약합니다. 규칙적으로 소량씩 자주 급식하고, 무기력·떨림·경련이 보이면 즉시 병원으로 가세요.'
from breeds b where b.name_ko = '치와와' on conflict do nothing;

insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '수두증(뇌수종) 주의', '치와와는 두개골이 작아 수두증 발생 위험이 있습니다. 비정상적인 보행, 경련, 눈 이상이 보이면 즉시 검진받으세요.'
from breeds b where b.name_ko = '치와와' on conflict do nothing;

-- 아키타 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '자가면역 질환 주의', '아키타는 자가면역 질환(VKH 증후군, 면역성 혈소판감소증 등) 발생률이 있습니다. 눈 색소 변화, 피부 변화가 보이면 검진받으세요.'
from breeds b where b.name_ko = '아키타' on conflict do nothing;

-- 진돗개 특화
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description)
select b.id, 12, 240, '질환', '비교적 건강하나 정기 검진 필수', '진돗개는 비교적 건강한 견종이지만, 연 1회 기본 혈액검사와 심장사상충 검사는 반드시 받으세요.'
from breeds b where b.name_ko = '진돗개' on conflict do nothing;

-- 퍼피 공통 추가 건강 가이드
insert into health_guides (breed_id, age_month_min, age_month_max, category, title, description) values
(null, 6, 11, '중성화', '중성화 수술 적기 안내', '대부분의 소형견은 생후 6개월, 대형견은 12~18개월 전후가 중성화 수술 적기입니다. 수의사와 상담 후 결정하세요.')
on conflict do nothing;
