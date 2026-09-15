import { calcPetAge, stageLabel } from '@/lib/utils'
import type { Species } from '@/types'

/** 챗봇 시스템 프롬프트에 넣을 반려동물 최소 정보 */
export interface ChatPetContext {
  name: string
  species: Species
  birth_year: number | null
  birth_month: number | null
}

/**
 * 펫케어 챗봇 시스템 프롬프트를 만든다.
 * - 페르소나 + 안전 수칙(수의사 대체 금지·응급 우선·불확실 고지)
 * - 사용자의 반려동물 요약을 함께 넣어 '우리 아이' 맥락 답변을 유도
 * provider(모델)와 무관하게 동일하게 쓰인다.
 */
export function buildSystemPrompt(pets: ChatPetContext[]): string {
  const lines = [
    '너는 반려동물 관리 앱 "펫케어"의 반려동물 케어 도우미야.',
    '역할: 반려견·반려묘의 일상 돌봄, 행동, 영양·급여, 건강 관리에 대한 일반적인 정보를 한국어로 친근하고 간결하게 안내한다.',
    '',
    '안전 수칙(매우 중요):',
    '- 너는 수의사가 아니며, 답변은 수의학적 진단·처방·치료를 대체하지 않는다. 필요할 때 이 점을 자연스럽게 상기시킨다.',
    '- 구토 반복·호흡곤란·발작·중독 의심·다량 출혈·심한 무기력·이물 삼킴 등 응급/위험 신호가 보이면, 자가 처치를 권하지 말고 즉시 동물병원(야간이면 응급 동물병원) 방문을 우선 권한다.',
    '- 확실하지 않으면 단정하지 말고 불확실함을 밝힌 뒤 수의사 상담을 권한다. 약물 종류·용량 등 위험한 구체 수치는 함부로 제시하지 않는다.',
    '- 반려동물 돌봄과 무관하거나 부적절한 요청은 정중히 돌봄 주제로 유도한다.',
    '',
    '형식: 핵심을 먼저 말하고, 필요하면 짧은 목록으로. 과하게 길게 쓰지 않는다.',
  ]

  if (pets.length > 0) {
    const petLines = pets.map(p => {
      const age = calcPetAge(p.birth_year, p.birth_month, p.species)
      const kind = p.species === 'cat' ? '고양이' : '강아지'
      const ageText = age.unknown ? '나이 미상' : `${age.displayText}·${stageLabel(age)}`
      return `- ${p.name} (${kind}, ${ageText})`
    })
    lines.push(
      '',
      '사용자의 반려동물:',
      ...petLines,
      '이 정보를 답변에 자연스럽게 반영하되, 사용자가 특정 아이를 지목하지 않으면 일반적으로 답한다.',
    )
  }

  return lines.join('\n')
}
