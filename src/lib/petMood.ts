/**
 * 연속 기록일(streak)에 따른 반려동물 '기분' — 홈 요약 아바타에 작은 반응(이모지+테두리)으로
 * 표시해, 숫자·뱃지로만 있던 성취 신호를 정서적인 캐릭터 반응으로 바꾼다(참여·재방문 유도).
 * 이미 계산되는 streak 만 입력으로 쓰며 별도 저장/백엔드가 없다. 결정적이라 테스트 가능.
 *
 * label 은 접근성(aria)·표시용 한국어 (앱이 ko 단일 로케일이라 lib 정적 데이터로 둔다 —
 * foodGuideData·careGuideData 와 동일 방침).
 */
export interface PetMood {
  /** 아바타에 겹쳐 보일 기분 이모지 */
  emoji: string
  /** 표시/aria 용 한 줄 라벨 */
  label: string
  /** 아바타 테두리 강조 (Tailwind ring 클래스, 없으면 빈 문자열) */
  ring: string
}

/** 연속 기록일수만으로 정하는 기본 기분 단계. 오래 챙길수록 아이가 더 신나 보인다. */
function moodByStreak(streak: number): PetMood {
  if (streak >= 14) return { emoji: '🤩', label: '최고로 신나요', ring: 'ring-4 ring-amber-300' }
  if (streak >= 7) return { emoji: '😆', label: '아주 신나요', ring: 'ring-4 ring-amber-200' }
  if (streak >= 3) return { emoji: '😄', label: '행복해요', ring: 'ring-2 ring-amber-200' }
  if (streak >= 1) return { emoji: '🙂', label: '기분 좋아요', ring: 'ring-2 ring-white/50' }
  return { emoji: '🐾', label: '오늘 기록을 기다려요', ring: '' }
}

/**
 * 연속 기록일수(장기 신호)와 '오늘 돌봄 완료 정도'(당일 신호)를 함께 반영해 아이의 기분을 정한다.
 *
 * 예전엔 연속일(streak)만 봐서, 오늘 밥·물·배변·산책을 다 챙겨도 연속이 짧으면(예: 첫날) 아이가
 * 시큰둥해 보였다. 하루의 돌봄을 마친 '지금 이 순간'의 정서적 보상이 없던 셈이라, 오늘 완료도를
 * 더해 방금 챙긴 노력이 즉시 표정에 반영되게 한다(참여·재방문 유도).
 *
 * @param streak 오늘 기준 연속 생활기록 일수(0 이상)
 * @param todayDone 오늘 챙긴 핵심 돌봄 항목 수(밥·물·배변·산책 중, 0~todayTotal). 생략 시 0(당일 신호 없음).
 * @param todayTotal 오늘 핵심 돌봄 항목 총수(기본 4).
 */
export function petMood(streak: number, todayDone = 0, todayTotal = 4): PetMood {
  // 오늘 핵심 돌봄을 모두 마치면 연속일과 무관하게 '활짝' — 하루 완료의 즉각 보상.
  if (todayTotal > 0 && todayDone >= todayTotal) {
    return { emoji: '🥰', label: '오늘 돌봄 완료, 행복해요', ring: 'ring-4 ring-amber-300' }
  }
  const base = moodByStreak(streak)
  // 오늘 아직 아무것도 안 챙긴 연속 0일도, 일부라도 챙기면 최소 '기분 좋아요'까지 살짝 올려준다.
  if (todayDone > 0 && streak === 0) {
    return { emoji: '🙂', label: '챙겨줘서 기분 좋아요', ring: 'ring-2 ring-white/50' }
  }
  return base
}

/**
 * 아이의 '한 줄 말풍선' 대사 — 아바타 옆에 캐릭터가 말을 거는 느낌을 주어 매일의 돌봄에
 * 정서적 계기를 더한다(숫자·뱃지 위주 신호를 캐릭터 상호작용으로 확장).
 *
 * 결정적(무작위·시간 미사용)이라 서버/클라이언트 동일 재현·테스트가 가능하다. 상태 우선순위:
 * 오늘 완료 → 긴 연속(격려) → 일부 완료(조금만 더) → 오늘 시작 전(기다림) → 첫 만남(폴백).
 * petMood 와 동일하게 한국어 대사를 데이터로 둔다(표시용이라 i18n 불필요 — foodGuideData 방침).
 *
 * @param streak 연속 생활기록 일수(0 이상)
 * @param todayDone 오늘 챙긴 핵심 돌봄 항목 수(0~todayTotal)
 * @param todayTotal 오늘 핵심 돌봄 항목 총수(기본 4)
 */
export function petSpeech(streak: number, todayDone = 0, todayTotal = 4): string {
  if (todayTotal > 0 && todayDone >= todayTotal) {
    return streak >= 3
      ? `${streak}일째 하루도 안 빠졌어요, 최고예요! 🎉`
      : '오늘도 다 챙겨줘서 고마워요! 🐾'
  }
  if (todayDone > 0) {
    const left = todayTotal - todayDone
    return `조금만 더! ${left}가지만 채우면 오늘 완료예요 💪`
  }
  if (streak >= 3) return `우리 ${streak}일째 함께하고 있어요, 오늘도 시작해볼까요?`
  if (streak >= 1) return '어제도 챙겨줘서 좋았어요, 오늘도 부탁해요 🙂'
  return '오늘 첫 기록을 기다리고 있어요 🐾'
}
