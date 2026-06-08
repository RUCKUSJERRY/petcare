-- ============================================================
--  007: breed_food_rules 시드 데이터
--  견종별 음식 주의사항 (의학적 근거 기반)
--  출처: AKC, ASPCA, VCA Hospitals
-- ============================================================

-- ───────────────────────────────────────────────
-- 강아지 견종별 음식 규칙
-- ───────────────────────────────────────────────

-- 푸들(토이): 췌장염 취약 → 고지방 식품 더 위험
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '토이 푸들은 췌장염에 취약합니다. 고지방 식품인 땅콩버터는 소량이라도 췌장염을 유발할 수 있어요'
from breeds b, food_items f
where b.name_ko = '푸들(토이)' and f.name_ko = '땅콩버터'
on conflict (breed_id, food_id) do nothing;

insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '소형 푸들은 유당 민감도가 높아 우유가 심한 소화 장애를 유발할 수 있어요'
from breeds b, food_items f
where b.name_ko = '푸들(토이)' and f.name_ko = '우유'
on conflict (breed_id, food_id) do nothing;

insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'caution',
  '토이 푸들은 저혈당에 주의가 필요해요. 감자 등 탄수화물은 적당량만 주세요'
from breeds b, food_items f
where b.name_ko = '푸들(토이)' and f.name_ko = '감자'
on conflict (breed_id, food_id) do nothing;

-- 말티즈: 소화기 민감, 알레르기
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '말티즈는 유당 불내성이 심해 우유가 극심한 설사·구토를 유발할 수 있어요'
from breeds b, food_items f
where b.name_ko = '말티즈' and f.name_ko = '우유'
on conflict (breed_id, food_id) do nothing;

insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '말티즈는 고지방 식품에 민감해 췌장염 위험이 있어요. 땅콩버터는 피하세요'
from breeds b, food_items f
where b.name_ko = '말티즈' and f.name_ko = '땅콩버터'
on conflict (breed_id, food_id) do nothing;

-- 닥스훈트: 비만→척추 디스크 위험
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '닥스훈트는 비만 시 척추 디스크에 심각한 부담을 줍니다. 고칼로리 땅콩버터는 피하세요'
from breeds b, food_items f
where b.name_ko = '닥스훈트' and f.name_ko = '땅콩버터'
on conflict (breed_id, food_id) do nothing;

insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'caution',
  '닥스훈트는 체중 관리가 척추 건강에 필수입니다. 감자 급여는 최소화하세요'
from breeds b, food_items f
where b.name_ko = '닥스훈트' and f.name_ko = '감자'
on conflict (breed_id, food_id) do nothing;

-- 비글: 비만 경향 강함
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '비글은 비만 경향이 매우 강해요. 고칼로리 땅콩버터는 체중 관리를 방해합니다'
from breeds b, food_items f
where b.name_ko = '비글' and f.name_ko = '땅콩버터'
on conflict (breed_id, food_id) do nothing;

insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'caution',
  '비글은 과식 경향이 있어요. 감자 급여량을 엄격히 제한하세요'
from breeds b, food_items f
where b.name_ko = '비글' and f.name_ko = '감자'
on conflict (breed_id, food_id) do nothing;

-- 프렌치불독: 단두종(호흡기) + 비만
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '프렌치불독은 비만이 호흡 문제를 악화시킵니다. 고칼로리 땅콩버터는 피하세요'
from breeds b, food_items f
where b.name_ko = '프렌치불독' and f.name_ko = '땅콩버터'
on conflict (breed_id, food_id) do nothing;

insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'caution',
  '브로콜리는 가스를 유발해 단두종인 프렌치불독의 호흡 불편을 악화시킬 수 있어요'
from breeds b, food_items f
where b.name_ko = '프렌치불독' and f.name_ko = '브로콜리'
on conflict (breed_id, food_id) do nothing;

-- 포메라니안: 탈모 증후군(고지방 악화), 소형견 저혈당
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '포메라니안은 고지방 식품이 탈모 증후군(BSD)을 악화시킬 수 있어요'
from breeds b, food_items f
where b.name_ko = '포메라니안' and f.name_ko = '땅콩버터'
on conflict (breed_id, food_id) do nothing;

insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '포메라니안은 유당 민감도가 높아 우유가 소화 장애를 유발할 수 있어요'
from breeds b, food_items f
where b.name_ko = '포메라니안' and f.name_ko = '우유'
on conflict (breed_id, food_id) do nothing;

-- 시츄: 호흡기·안구 민감, 소화 약함
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '시츄는 소화기가 민감해 우유로 인한 설사·구토가 심하게 나타날 수 있어요'
from breeds b, food_items f
where b.name_ko = '시츄' and f.name_ko = '우유'
on conflict (breed_id, food_id) do nothing;

insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'caution',
  '브로콜리의 가스는 단두종인 시츄의 호흡 불편을 악화시킬 수 있어요'
from breeds b, food_items f
where b.name_ko = '시츄' and f.name_ko = '브로콜리'
on conflict (breed_id, food_id) do nothing;

-- 래브라도 리트리버: 비만·고관절
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'caution',
  '래브라도는 비만 경향이 강해요. 땅콩버터는 소량만 간식으로 주세요'
from breeds b, food_items f
where b.name_ko = '래브라도 리트리버' and f.name_ko = '땅콩버터'
on conflict (breed_id, food_id) do nothing;

-- 골든 리트리버: 비만, 암 발생률
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'caution',
  '골든 리트리버는 체중 관리가 중요해요. 땅콩버터는 극소량만 허용하세요'
from breeds b, food_items f
where b.name_ko = '골든 리트리버' and f.name_ko = '땅콩버터'
on conflict (breed_id, food_id) do nothing;

-- ───────────────────────────────────────────────
-- 고양이 묘종별 음식 규칙
-- ───────────────────────────────────────────────

-- 페르시안: 소화 민감, 과식 경향
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '페르시안은 유당 민감도가 매우 높아 우유가 심한 설사를 유발해요. 고양이 전용 우유만 허용'
from breeds b, food_items f
where b.name_ko = '페르시안' and f.name_ko = '우유'
on conflict (breed_id, food_id) do nothing;

-- 메인쿤: 비만·심근증 주의
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '메인쿤은 심근증 위험이 있어 유제품 등 지방·염분 부담 식품을 피해야 해요'
from breeds b, food_items f
where b.name_ko = '메인쿤' and f.name_ko = '치즈'
on conflict (breed_id, food_id) do nothing;

-- 코리안 숏헤어: 요로질환 주의
insert into breed_food_rules (breed_id, food_id, override_safety, note)
select b.id, f.id, 'dangerous',
  '코리안 숏헤어는 요로질환 경향이 있어요. 유제품의 미네랄 부담을 피하세요'
from breeds b, food_items f
where b.name_ko = '코리안 숏헤어' and f.name_ko = '우유'
on conflict (breed_id, food_id) do nothing;
