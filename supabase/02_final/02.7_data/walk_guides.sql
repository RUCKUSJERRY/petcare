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
