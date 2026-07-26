/**
 * BCS(Body Condition Score) 자가진단 — 집에서 갈비뼈·허리선·복부 라인으로 체형을 가늠하는
 * WSAVA/AAHA 표준 방법의 실전 요약. 3개 항목의 답을 모아 저체중/이상적/과체중을 판정한다.
 *
 * 의료 진단이 아니라 보호자용 참고 지표다. 결과는 저장하지 않고 화면에서 즉시 안내한다.
 * (순수 함수 — Math.random()·Date 미사용, 서버/클라이언트에서 동일하게 재현·테스트 가능)
 */

/** 각 문항 응답이 가리키는 체형 신호 */
export type BcsSignal = 'under' | 'ideal' | 'over'

/** 최종 판정 결과 */
export type BcsResult = 'under' | 'ideal' | 'over'

export interface BcsOption {
  signal: BcsSignal
  label: string
}

export interface BcsQuestion {
  id: 'ribs' | 'waist' | 'abdomen'
  icon: string
  /** 확인 포인트 제목 */
  topic: string
  /** 질문 문구 */
  question: string
  options: BcsOption[]
}

/** 자가진단 문항 (갈비뼈·허리선·복부). 옵션 순서: 저체중 → 이상적 → 과체중 신호. */
export const BCS_QUESTIONS: BcsQuestion[] = [
  {
    id: 'ribs',
    icon: '🖐️',
    topic: '갈비뼈',
    question: '갈비뼈를 손으로 만졌을 때 느낌은 어떤가요?',
    options: [
      { signal: 'under', label: '눈에 보일 정도로 도드라진다' },
      { signal: 'ideal', label: '살짝 힘줘 만지면 손등 뼈처럼 만져진다' },
      { signal: 'over', label: '지방에 덮여 잘 만져지지 않는다' },
    ],
  },
  {
    id: 'waist',
    icon: '👀',
    topic: '허리선',
    question: '위에서 내려다봤을 때 허리 라인은 어떤가요?',
    options: [
      { signal: 'under', label: '허리가 매우 잘록하고 골반뼈가 두드러진다' },
      { signal: 'ideal', label: '갈비뼈 뒤로 잘록한 허리가 보인다' },
      { signal: 'over', label: '허리 구분 없이 일자이거나 바깥으로 볼록하다' },
    ],
  },
  {
    id: 'abdomen',
    icon: '🐾',
    topic: '복부',
    question: '옆에서 봤을 때 배(복부) 라인은 어떤가요?',
    options: [
      { signal: 'under', label: '배가 심하게 위로 말려 올라가 있다' },
      { signal: 'ideal', label: '가슴보다 배가 위로 접혀 올라간다(턱업)' },
      { signal: 'over', label: '배가 처지거나 바닥과 거의 평행하다' },
    ],
  },
]

const SIGNAL_SCORE: Record<BcsSignal, number> = { under: -1, ideal: 0, over: 1 }

/**
 * 문항 신호들을 합산해 체형을 판정한다.
 * 합계 ≤ -2 → 저체중, -1~+1 → 이상적, ≥ +2 → 과체중.
 * 모든 문항에 답하지 않았으면(개수 부족) null.
 */
export function scoreBcs(signals: BcsSignal[]): BcsResult | null {
  if (signals.length < BCS_QUESTIONS.length) return null
  const sum = signals.reduce((acc, s) => acc + SIGNAL_SCORE[s], 0)
  if (sum <= -2) return 'under'
  if (sum >= 2) return 'over'
  return 'ideal'
}

export interface BcsOutcome {
  result: BcsResult
  icon: string
  /** 결과 제목 */
  title: string
  /** 한 줄 요약 */
  summary: string
  /** 실천 권장 사항 */
  actions: string[]
  /** 결과 배지/카드 색상 톤 키 (UI 매핑용) */
  tone: 'amber' | 'green' | 'red'
}

/** 판정 결과별 안내(요약·권장 행동). */
export function bcsOutcome(result: BcsResult): BcsOutcome {
  switch (result) {
    case 'under':
      return {
        result, icon: '🍚', tone: 'amber',
        title: '저체중에 가까워요',
        summary: '갈비뼈·골반이 도드라지는 편이에요. 급여량이 충분한지 살펴보세요.',
        actions: [
          '하루 급여량이 권장량에 맞는지 급여 계산기로 확인하세요.',
          '체중을 2주 간격으로 기록해 회복 추세를 확인하세요.',
          '식욕 저하·급격한 체중 감소가 있으면 질병 신호일 수 있어 수의사와 상담하세요.',
        ],
      }
    case 'over':
      return {
        result, icon: '⚖️', tone: 'red',
        title: '과체중에 가까워요',
        summary: '갈비뼈가 잘 만져지지 않고 허리 구분이 약해요. 비만은 관절·당뇨·심장질환 위험을 높여요.',
        actions: [
          '하루 급여량을 10~20% 줄이고 간식을 총 칼로리의 10% 이내로 제한하세요.',
          '체중을 2주 간격으로 기록해 감량 추세를 확인하세요.',
          '식단 조절만으로 변화가 없으면 수의사와 상담해 다이어트 계획을 세우세요.',
        ],
      }
    default:
      return {
        result, icon: '✅', tone: 'green',
        title: '이상적인 체형이에요',
        summary: '갈비뼈가 적당히 만져지고 허리·턱업 라인이 잘 잡혀 있어요. 지금 관리를 유지하세요.',
        actions: [
          '현재 급여량·활동량을 유지하세요.',
          '체중을 월 1회 이상 기록해 변화를 조기에 감지하세요.',
        ],
      }
  }
}
