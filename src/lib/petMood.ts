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

/**
 * 연속 기록일수를 기분 단계로 매핑한다. 오래 챙길수록 아이가 더 신나 보인다.
 * @param streak 오늘 기준 연속 생활기록 일수(0 이상)
 */
export function petMood(streak: number): PetMood {
  if (streak >= 14) return { emoji: '🤩', label: '최고로 신나요', ring: 'ring-4 ring-amber-300' }
  if (streak >= 7) return { emoji: '😆', label: '아주 신나요', ring: 'ring-4 ring-amber-200' }
  if (streak >= 3) return { emoji: '😄', label: '행복해요', ring: 'ring-2 ring-amber-200' }
  if (streak >= 1) return { emoji: '🙂', label: '기분 좋아요', ring: 'ring-2 ring-white/50' }
  return { emoji: '🐾', label: '오늘 기록을 기다려요', ring: '' }
}
