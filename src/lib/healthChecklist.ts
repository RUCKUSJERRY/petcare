import type { PetAge, Species } from '@/types'

/**
 * 생애주기별 '건강 체크리스트' — 큐레이션 정적 데이터.
 * 종(species)×생애단계(lifeStage)별로, 그 시기에 챙기면 좋은 예방·관찰 포인트를 담는다.
 * 널리 통용되는 예방수의학(백신·기생충 예방·정기검진·구강·체중 관리)의 일반 권장사항을 기반으로 하며,
 * 개별 진단·치료를 대체하지 않는다(모든 항목은 "수의사 상담"을 전제로 한 안내).
 * DB가 아닌 정적 데이터라 결정적·테스트 가능하다.
 */

export type LifeStage = PetAge['lifeStage']

export interface ChecklistItem {
  icon: string
  title: string
  detail: string
}

export interface StageChecklist {
  species: Species
  stage: LifeStage
  /** 시기 한 줄 요약 */
  summary: string
  items: ChecklistItem[]
}

const DOG_CHECKLISTS: Record<LifeStage, StageChecklist> = {
  퍼피: {
    species: 'dog', stage: '퍼피',
    summary: '기초 면역과 사회화를 만드는 가장 중요한 시기예요.',
    items: [
      { icon: '💉', title: '기초 예방접종', detail: '종합백신은 보통 생후 6~16주에 2~4주 간격으로 접종해요. 항체가 형성되기 전에는 산책·다른 개 접촉을 조심하세요.' },
      { icon: '🐛', title: '기생충 예방 시작', detail: '내부 구충과 심장사상충 예방을 언제 시작할지 수의사와 상담하세요(대개 생후 6~8주부터).' },
      { icon: '🦷', title: '치아 교환 관찰', detail: '생후 4~7개월에 젖니가 영구치로 바뀌어요. 젖니가 빠지지 않고 남는 이중치가 있는지 살펴보세요.' },
      { icon: '🐾', title: '사회화(3~14주)', detail: '다양한 사람·소리·환경을 긍정적으로 경험시키면 겁 많은 성견이 되는 것을 예방해요.' },
      { icon: '✂️', title: '중성화 시기 상담', detail: '견종·크기에 따라 적절한 시기가 달라요. 성장판·행동을 고려해 수의사와 시점을 정하세요.' },
    ],
  },
  성견: {
    species: 'dog', stage: '성견',
    summary: '큰 병 없이 지내기 쉬운 시기지만, 예방과 체중 관리가 핵심이에요.',
    items: [
      { icon: '🩺', title: '연 1회 건강검진', detail: '증상이 없어도 매년 기본 검진으로 기준값을 쌓아두면 이상을 일찍 발견할 수 있어요.' },
      { icon: '🛡️', title: '연중 기생충 예방', detail: '심장사상충·내외부 기생충 예방을 거르지 않고 이어가세요.' },
      { icon: '⚖️', title: '체중·체형(BCS) 관리', detail: '갈비뼈가 만져지는 정도로 유지하세요. 비만은 관절·심장·당뇨 위험을 높여요.' },
      { icon: '🦷', title: '치석·구강 관리', detail: '매일 양치가 이상적이며, 연 1회 구강 상태를 점검하세요.' },
    ],
  },
  시니어: {
    species: 'dog', stage: '시니어',
    summary: '노령기(대형견은 더 이르게)엔 검진 주기를 좁히고 변화를 기록하세요.',
    items: [
      { icon: '🩸', title: '6~12개월 정기검진', detail: '혈액·소변 검사를 포함해 신장·간·심장을 정기적으로 확인하세요.' },
      { icon: '🦴', title: '관절 건강', detail: '계단·산책을 꺼리면 관절염 신호일 수 있어요. 체중 관리와 보조제를 상담하세요.' },
      { icon: '👀', title: '감각·인지 변화', detail: '백내장, 청력 저하, 밤에 서성이는 인지장애 신호를 관찰하세요.' },
      { icon: '📝', title: '식욕·음수·배뇨 기록', detail: '먹는 양·물 마시는 양·소변 변화는 질병의 조기 신호예요. 기록해 두면 진료에 도움돼요.' },
    ],
  },
  키튼: DUMMY(), 성묘: DUMMY(), // dog 맵에는 고양이 단계가 없음(방어적 폴백은 selector에서 처리)
}

const CAT_CHECKLISTS: Record<LifeStage, StageChecklist> = {
  키튼: {
    species: 'cat', stage: '키튼',
    summary: '기초 면역과 안전한 실내 환경을 만드는 시기예요.',
    items: [
      { icon: '💉', title: '기초 예방접종', detail: '3종 코어백신은 보통 생후 6~16주에 접종해요. 접종 완료 전에는 외출·외부 고양이 접촉을 피하세요.' },
      { icon: '🐛', title: '구충·예방', detail: '내부 기생충 구충 일정과 실내묘의 예방 범위를 수의사와 상담하세요.' },
      { icon: '🧶', title: '실내 안전', detail: '끈·실·작은 이물질은 삼키면 위험해요. 화분·전선·틈새를 점검하세요.' },
      { icon: '✂️', title: '중성화 시기 상담', detail: '보통 생후 6개월 전후에 권장돼요. 시점을 수의사와 정하세요.' },
    ],
  },
  성묘: {
    species: 'cat', stage: '성묘',
    summary: '겉으로 건강해 보여도, 비만·요로·구강 문제를 특히 살펴야 해요.',
    items: [
      { icon: '🩺', title: '연 1회 건강검진', detail: '고양이는 아픈 것을 잘 숨겨요. 매년 검진으로 기준값을 쌓아두세요.' },
      { icon: '🚽', title: '하부요로계(FLUTD) 관찰', detail: '배뇨 곤란·혈뇨·화장실 밖 배뇨는 응급일 수 있어요. 특히 수컷은 요도 막힘에 주의하세요.' },
      { icon: '⚖️', title: '비만·음수 관리', detail: '실내묘 비만이 흔해요. 적정 급여량과 충분한 음수(급수기·습식)를 챙기세요.' },
      { icon: '🦷', title: '치아·구내염 관찰', detail: '침 흘림·입 냄새·식사 거부는 구강 통증 신호일 수 있어요.' },
    ],
  },
  시니어: {
    species: 'cat', stage: '시니어',
    summary: '노령묘(보통 11세 이상)는 신장·갑상선 등 만성질환 관찰이 중요해요.',
    items: [
      { icon: '🩸', title: '6~12개월 정기검진', detail: '만성신장병·갑상선기능항진증이 흔해요. 신장 수치·갑상선·혈압을 정기적으로 확인하세요.' },
      { icon: '💧', title: '음수·배뇨·체중 변화', detail: '물을 많이 마시거나 체중이 줄면 신장·갑상선·당뇨 신호일 수 있어요. 기록해 두세요.' },
      { icon: '🦴', title: '관절염 관찰', detail: '높은 곳에 잘 못 오르거나 그루밍이 줄면 관절 통증일 수 있어요.' },
      { icon: '🍽️', title: '식욕 변화', detail: '식욕이 늘거나 주는 변화는 조기 진단의 단서예요. 진료 시 알려주세요.' },
    ],
  },
  퍼피: DUMMY(), 성견: DUMMY(),
}

/** 잘못된 조합(예: dog 맵의 '키튼')에는 접근하지 않지만, 타입 완전성을 위한 자리채움. */
function DUMMY(): StageChecklist {
  return { species: 'dog', stage: '성견', summary: '', items: [] }
}

/**
 * 종·생애단계에 맞는 체크리스트를 반환한다.
 * 나이 미상 등으로 단계가 애매하면 성체(성견/성묘) 기준으로 폴백한다.
 */
export function healthChecklistFor(species: Species, stage: LifeStage | '미상'): StageChecklist {
  const map = species === 'cat' ? CAT_CHECKLISTS : DOG_CHECKLISTS
  const valid: LifeStage[] = species === 'cat' ? ['키튼', '성묘', '시니어'] : ['퍼피', '성견', '시니어']
  const s = (stage !== '미상' && valid.includes(stage as LifeStage)) ? (stage as LifeStage) : (species === 'cat' ? '성묘' : '성견')
  return map[s]
}
