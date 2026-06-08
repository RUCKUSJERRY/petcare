-- ============================================================
--  008: walk_guides → activity_type 컬럼 추가 + 활동 가이드 확장
--  기존 강아지 데이터 → '산책', 고양이 데이터 → '사냥놀이'로 분류
--  새로 추가: 실내놀이, 인지훈련 (강아지) / 실내탐험, 인지훈련 (고양이)
-- ============================================================

-- 1. 컬럼 추가
alter table walk_guides
  add column if not exists activity_type text not null default '산책';

-- 2. 기존 고양이 데이터 → 사냥놀이로 재분류
update walk_guides set activity_type = '사냥놀이' where species = 'cat';

-- ───────────────────────────────────────────────
-- 3. 강아지 — 실내놀이
-- ───────────────────────────────────────────────
insert into walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips) values
(null, null, 'dog', 0, 11, '실내놀이', 20, '활발',
  '공놀이·터그놀이를 짧게 자주 반복하세요. 관절이 발달 중이니 점프·계단은 자제하고, 폭신한 바닥에서 놀아주세요.'),
(null, null, 'dog', 12, 83, '실내놀이', 20, '보통',
  '공던지기, 숨바꼭질, 터그놀이 등으로 실내에서도 충분히 운동할 수 있어요. 날씨가 나쁜 날 특히 유용해요.'),
(null, null, 'dog', 84, 240, '실내놀이', 15, '가벼움',
  '시니어 강아지는 짧은 놀이를 여러 번 나누세요. 관절 부담이 적은 부드러운 장난감을 활용하고, 무리한 점프는 피하세요.')
on conflict do nothing;

-- 소형견 실내놀이 (슬개골 주의)
insert into walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips) values
(null, '소형', 'dog', 12, 83, '실내놀이', 15, '보통',
  '소형견은 슬개골 탈구를 주의하세요. 낮은 점프 위주의 놀이와 미끄럼 방지 매트를 깔아주는 것이 좋아요.')
on conflict do nothing;

-- ───────────────────────────────────────────────
-- 4. 강아지 — 인지훈련
-- ───────────────────────────────────────────────
insert into walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips) values
(null, null, 'dog', 0, 11, '인지훈련', 10, '가벼움',
  '앉아·기다려·이리와 등 기초 명령어를 짧게 반복하세요. 집중 시간이 짧으니 한 세션은 5분 이내가 효과적이에요. 간식 보상을 활용하세요.'),
(null, null, 'dog', 12, 83, '인지훈련', 15, '보통',
  '노즈워크(냄새로 간식 찾기), 퍼즐 피더, 클리커 트릭 훈련으로 두뇌를 자극하세요. 정신적 자극은 신체 운동만큼 피로를 줘요.'),
(null, null, 'dog', 84, 240, '인지훈련', 10, '가벼움',
  '시니어도 인지 자극이 중요해요. 간단한 퍼즐 피더나 냄새 탐색 게임은 인지 기능 유지에 도움이 됩니다.')
on conflict do nothing;

-- ───────────────────────────────────────────────
-- 5. 고양이 — 실내탐험
-- ───────────────────────────────────────────────
insert into walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips) values
(null, null, 'cat', 0, 11, '실내탐험', 20, '활발',
  '새끼 고양이는 탐험 욕구가 왕성해요. 박스 미로, 터널 장난감, 캣타워로 수직·수평 공간을 충분히 제공하세요. 새로운 물건을 자주 교체해 호기심을 자극하세요.'),
(null, null, 'cat', 12, 83, '실내탐험', 15, '보통',
  '캣타워, 창문 해먹, 선반 등 수직 공간이 중요해요. 환경 풍부화(새 박스, 종이백, 캣닙 장난감)는 스트레스 해소에 효과적이에요.'),
(null, null, 'cat', 84, 240, '실내탐험', 10, '가벼움',
  '시니어 고양이에게는 낮은 캣타워나 계단을 제공해 관절 부담 없이 탐험할 수 있게 해주세요. 따뜻하고 편안한 쉼터도 잊지 마세요.')
on conflict do nothing;

-- ───────────────────────────────────────────────
-- 6. 고양이 — 인지훈련
-- ───────────────────────────────────────────────
insert into walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips) values
(null, null, 'cat', 0, 11, '인지훈련', 10, '보통',
  '고양이도 훈련이 가능해요! 클리커로 하이파이브, 이리와를 가르쳐보세요. 짧은 세션과 고가치 간식(참치, 치킨)이 핵심이에요.'),
(null, null, 'cat', 12, 83, '인지훈련', 10, '가벼움',
  '퍼즐 피더, 숨긴 간식 찾기, 노즈워크로 정신적 자극을 주세요. 밥을 퍼즐 피더로 제공하면 매일 자연스럽게 두뇌 운동이 돼요.'),
(null, null, 'cat', 84, 240, '인지훈련', 10, '가벼움',
  '간단한 퍼즐 피더로 식사 시간을 놀이로 만들어주세요. 인지 자극은 노화 속도를 늦추고 삶의 질을 높여줘요.')
on conflict do nothing;

-- ───────────────────────────────────────────────
-- 7. 견종별 특화 가이드 (산책)
-- ───────────────────────────────────────────────

-- 래브라도/골든 — 수영 (대형견, 수영 본능)
insert into walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips)
select b.id, null, 'dog', 12, 83, '실내놀이', 30, '활발',
  '래브라도는 에너지가 넘쳐요. 공던지기, 수영, 달리기 등 격렬한 운동을 충분히 해줘야 문제 행동을 예방할 수 있어요.'
from breeds b where b.name_ko = '래브라도 리트리버'
on conflict do nothing;

insert into walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips)
select b.id, null, 'dog', 12, 83, '실내놀이', 30, '활발',
  '골든 리트리버는 공놀이·수영을 매우 좋아해요. 하루 충분한 운동이 비만 예방과 관절 건강에 중요해요.'
from breeds b where b.name_ko = '골든 리트리버'
on conflict do nothing;

-- 보더콜리 — 인지훈련 특화
insert into walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips)
select b.id, null, 'dog', 12, 83, '인지훈련', 30, '활발',
  '보더콜리는 세계 최고 지능의 견종이에요. 어질리티, 플라이볼, 고급 트릭 훈련으로 두뇌를 충분히 자극하지 않으면 문제 행동이 생겨요.'
from breeds b where b.name_ko = '보더콜리'
on conflict do nothing;

-- 뱅갈 고양이 — 사냥놀이 특화 (활동량 매우 많음)
insert into walk_guides (breed_id, size_category, species, age_month_min, age_month_max, activity_type, daily_minutes, intensity, tips)
select b.id, null, 'cat', 12, 83, '사냥놀이', 30, '활발',
  '뱅갈은 에너지가 매우 많아요. 하루 2~3회 격렬한 사냥 놀이가 필수예요. 충분히 놀아주지 않으면 가구를 망가뜨릴 수 있어요.'
from breeds b where b.name_ko = '뱅갈'
on conflict do nothing;
