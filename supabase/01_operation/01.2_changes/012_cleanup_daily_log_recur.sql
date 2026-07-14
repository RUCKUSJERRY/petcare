-- 생활기록(식사·간식·물·배변·투약)에 잘못 저장된 반복/예정 필드 정리.
--
-- 배경: 기록 입력 폼에서 반복 UI 는 생활기록에 숨겨져 있으나, 카테고리 전환 시(예: 접종에
-- 반복 설정 → 배변으로 변경) recurOn/manualDue 상태가 초기화되지 않아 생활기록에 recur_rule·
-- next_due_on 이 붙어 저장되던 버그가 있었다. 앱 코드는 카테고리 기준으로 이를 차단하도록
-- 고쳤지만(신규 저장분엔 안 생김), 그 전에 이미 저장된 과거 레코드는 캘린더에 '유령 반복'으로
-- 뜨거나 care-reminders 가 헛푸시를 보낼 수 있어 한 번 정리한다.
--
-- 생활기록은 시간순 타임라인 대상이라 반복/예정 개념이 없다 → 두 필드를 null 로 비운다.
-- idempotent: 재실행 시 대상이 없어 0건만 갱신된다.
update public.records
set recur_rule = null,
    next_due_on = null
where category in ('식사', '간식', '물', '배변', '투약')
  and (recur_rule is not null or next_due_on is not null);
