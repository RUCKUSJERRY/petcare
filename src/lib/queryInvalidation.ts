import type { QueryClient } from '@tanstack/react-query'

/**
 * 기록(records)·산책(walks) 한 건이 바뀌었을 때 무효화할 react-query 캐시 키를 한곳에 모은 모듈.
 *
 * 예전엔 '기록이 방금 생겼다/바뀌었다' 뒤처리가 화면마다 손으로 복제돼 있었다 - 원탭 바(QuickLogBar),
 * 홈 요약카드(SelectedPetSummary), 전역 FAB(QuickRecordFab), 아이 상세가 각기 다른, 서로 겹치는
 * 키 집합을 나열했고, 주석엔 "같은 기준"이라 적혀 있었지만 실제로는 드리프트가 생겼다. 대표적으로
 * 전역 FAB의 상세 입력(직접·스캔)으로 밥·물·배변을 기록하면 today-log·생활패턴·주간리포트·월간회고가
 * 누락돼, 홈 '오늘 돌봄 N/4'·기분·연속·주간 리포트·성장 레벨이 staleTime(기본 60s)만큼 옛값으로 남았다.
 * 산책 쪽도 저장(track)·삭제([id])·수동(WalkQuickLog) 세 경로가 서로의 거울상이어야 한다고 주석으로만
 * 약속돼 있었다. 집합을 함수 하나로 모아 그 드리프트를 구조적으로 없앤다.
 *
 * 두 함수 모두 부수효과는 qc.invalidateQueries 호출뿐이라, 가짜 QueryClient 로 호출 키를 검증할 수 있다.
 */

/**
 * 기록(records) 한 건이 생성·수정·삭제·되돌리기됐을 때, 그 기록을 집계원으로 쓰는 공용 화면 캐시를
 * 모두 무효화한다. (아이 상세의 카드 전용 키 ['pet-streak']·['pet-care-points'] 는 그 화면만의
 * 관심사라 여기 넣지 않고 호출부에서 덧붙인다 - 공용 캐시 / 카드 전용 키의 계층을 유지한다.)
 *
 * @param petId 기록 대상 아이. null 이면 '전체 아이' 스코프(홈 미선택·일정 오늘 탭)만 무효화한다.
 */
export function invalidateRecordCaches(qc: QueryClient, petId: string | null): void {
  // 전체 아이(null) 스코프 타임라인·피드 - 홈(선택 없음)·일정 '오늘' 탭에서 TodayTimeline/RecordFeed
  // 가 petId=null 로 쓰인다. 특정 아이로 기록해도 이 캐시가 남으면 새 기록이 최대 staleTime 동안 안 보였다.
  qc.invalidateQueries({ queryKey: ['today-timeline', null] })
  qc.invalidateQueries({ queryKey: ['record-feed', null] })
  // 예정(건강 일정) 알림 - 아이 스코프가 없는 전역 키.
  qc.invalidateQueries({ queryKey: ['care-schedule'] })
  if (!petId) return
  qc.invalidateQueries({ queryKey: ['today-log', petId] })
  qc.invalidateQueries({ queryKey: ['today-timeline', petId] })
  qc.invalidateQueries({ queryKey: ['record-feed', petId] })
  // 홈 생활 패턴 카드(최근 14일 추이·공백).
  qc.invalidateQueries({ queryKey: ['life-pattern', petId] })
  // 홈 주간 리포트(7일 활동·성장 레벨)·지난달 회고도 이 기록을 집계원으로 쓴다.
  // (키 접두 매칭으로 ['monthly-recap', petId, 시작일] 도 함께 무효화됨.)
  qc.invalidateQueries({ queryKey: ['weekly-report', petId] })
  qc.invalidateQueries({ queryKey: ['monthly-recap', petId] })
}

/**
 * 산책(walks) 한 건이 저장·삭제·수동기록됐을 때, 산책을 집계원으로 쓰는 캐시를 모두 무효화한다.
 * 저장(track)·삭제([id])·수동(WalkQuickLog) 세 경로가 정확히 같은 집합을 쓰도록 단일 출처로 둔다.
 *
 * @param petId 산책 대상 아이. null 이면 목록·목표 등 아이 스코프가 없는 키만 무효화한다.
 */
export function invalidateWalkCaches(qc: QueryClient, petId: string | null): void {
  qc.invalidateQueries({ queryKey: ['walks'] }) // 목록(mine/shared) 프리픽스 매칭
  qc.invalidateQueries({ queryKey: ['walk-goal'] }) // 이번 주 산책 목표 진행도
  if (!petId) return
  qc.invalidateQueries({ queryKey: ['today-walk', petId] }) // 홈 '오늘의 돌봄' 산책 체크·기분
  qc.invalidateQueries({ queryKey: ['weekly-report', petId] }) // 주간 리포트 활동 합계
  qc.invalidateQueries({ queryKey: ['monthly-recap', petId] }) // 월초 회고 거리 합계(접두 매칭)
  // 아이 상세 성장 레벨(PetCharacterCard)은 기록 수 + 산책 수로 레벨을 계산한다.
  qc.invalidateQueries({ queryKey: ['pet-care-points', petId] })
}
