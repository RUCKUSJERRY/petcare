-- ============================================================
--  016: 음식 데이터 보강 (개·고양이 안전도 포함)
--  출처: ASPCA, AKC 공개 자료 기준. 일반적 안내이며 개체차 있음.
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (idempotent)
-- ============================================================

-- 1) 음식 항목 추가 (이미 있으면 무시)
insert into public.food_items (name_ko, category) values
  ('사과',        '과일'),
  ('바나나',      '과일'),
  ('수박',        '과일'),
  ('딸기',        '과일'),
  ('고구마',      '채소'),
  ('오이',        '채소'),
  ('플레인 요거트','유제품'),
  ('호두',        '기타'),
  ('아몬드',      '기타'),
  ('가공육(햄·소시지)', '육류'),
  ('마늘',        '기타')
on conflict (name_ko) do nothing;

-- 2) 강아지(dog) 안전도
insert into public.food_safety (food_id, species, safety_level, reason, caution, source)
select fi.id, 'dog', v.lvl, v.reason, v.caution, 'ASPCA/AKC'
from (values
  ('사과',        'safe',      '비타민A·C와 섬유질이 풍부한 저칼로리 간식', '씨와 심은 제거하세요(씨앗에 시안화물)'),
  ('바나나',      'safe',      '칼륨·비타민이 풍부', '당분이 높아 소량만'),
  ('수박',        'safe',      '수분이 많아 더운 날 수분 보충에 좋음', '씨와 껍질은 제거하세요'),
  ('딸기',        'safe',      '항산화·비타민C 풍부', '당분이 있어 소량만'),
  ('고구마',      'safe',      '섬유질·베타카로틴이 풍부', '반드시 익혀서 양념 없이'),
  ('오이',        'safe',      '저칼로리 수분 간식', '얇게 썰어 소량만'),
  ('플레인 요거트','caution',  '단백질·칼슘 공급원이나 유당에 민감할 수 있음', '무가당·자일리톨 없는 제품만, 소화 장애 시 중단'),
  ('호두',        'dangerous', '곰팡이 독소·기름기로 구토·신경 증상·췌장염 위험', '특히 곰팡이 핀 호두는 매우 위험'),
  ('아몬드',      'caution',   '소화가 어렵고 고지방이라 췌장염·기도 막힘 위험', '권장하지 않음. 소금 간 제품은 금지'),
  ('가공육(햄·소시지)', 'caution', '염분·지방·보존료가 많아 비만·췌장염·나트륨 부담', '되도록 피하고 줄 경우 아주 소량'),
  ('마늘',        'dangerous', '파속 식물로 적혈구를 손상시켜 빈혈 유발', '익혀도 위험, 가루도 금지')
) as v(name_ko, lvl, reason, caution)
join public.food_items fi on fi.name_ko = v.name_ko
on conflict (food_id, species) do nothing;

-- 3) 고양이(cat) 안전도
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
  ('가공육(햄·소시지)', 'caution', '염분·지방·첨가물 과다', '되도록 피하세요'),
  ('마늘',        'dangerous', '개보다 민감하며 적혈구 손상·빈혈 유발', '소량·가루도 금지')
) as v(name_ko, lvl, reason, caution)
join public.food_items fi on fi.name_ko = v.name_ko
on conflict (food_id, species) do nothing;
