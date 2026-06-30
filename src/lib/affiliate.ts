import type { Species } from '@/types'

/**
 * 제휴(어필리에이트) 상품 카탈로그 + 클릭 추적.
 *
 * 수익 모델(B): 음식·활동·건강·생활관리 등 맥락에 맞는 추천 상품을 노출하고,
 * 제휴 링크를 통해 구매가 발생하면 수수료를 받는다(예: 쿠팡 파트너스).
 *
 * 실제 제휴 ID/링크는 코드에 하드코딩하지 않고 환경변수로 주입한다.
 *  - NEXT_PUBLIC_COUPANG_PARTNER_TAG : 쿠팡 파트너스 트래킹 태그(예: AF1234567)
 * 미설정 시에는 상품의 기본 link(검색/랜딩)를 그대로 사용한다.
 */

export type AffiliateContext = 'feed' | 'foods' | 'walk' | 'health' | 'care' | 'ad' | 'smart'

type ProductCategory = 'food' | 'supplement' | 'walk' | 'health' | 'care'

/** 맥락 → 노출할 상품 카테고리 */
const CONTEXT_CATEGORIES: Record<Exclude<AffiliateContext, 'ad' | 'smart'>, ProductCategory[]> = {
  feed: ['food'],
  foods: ['food', 'supplement'],
  walk: ['walk'],
  health: ['health', 'supplement'],
  care: ['care'],
}

export interface AffiliateProduct {
  id: string
  category: ProductCategory
  /** 노출 대상 종 (없으면 공통) */
  species?: Species
  emoji: string
  title: string
  desc: string
  /** 노출용 가격 텍스트 (선택) */
  priceText?: string
  /** 기본 링크 (제휴 태그가 있으면 파라미터로 부착) */
  link: string
}

const SEARCH = (q: string) => `https://www.coupang.com/np/search?q=${encodeURIComponent(q)}`

/**
 * MVP 카탈로그. 실제 운영 시에는 DB/CMS로 옮겨 관리할 수 있다.
 * link 는 제휴 랜딩(검색 결과 등)으로, 파트너 태그가 있으면 자동 부착된다.
 */
const CATALOG: AffiliateProduct[] = [
  // 사료 (음식)
  { id: 'dog-food', category: 'food', species: 'dog', emoji: '🦴', title: '강아지 사료 추천 모음', desc: '연령·체중별 베스트 건사료 비교', priceText: '특가', link: SEARCH('강아지 사료') },
  { id: 'cat-food', category: 'food', species: 'cat', emoji: '🐟', title: '고양이 사료 추천 모음', desc: '기호성 좋은 인기 건사료', priceText: '특가', link: SEARCH('고양이 사료') },
  // 영양제 (음식·건강)
  { id: 'dog-supplement', category: 'supplement', species: 'dog', emoji: '💊', title: '강아지 영양제·관절 보조제', desc: '관절·피부·장 건강 보조제', link: SEARCH('강아지 영양제') },
  { id: 'cat-supplement', category: 'supplement', species: 'cat', emoji: '💊', title: '고양이 영양제·헤어볼 케어', desc: '헤어볼·관절·영양 보조제', link: SEARCH('고양이 영양제') },
  // 활동 (산책)
  { id: 'dog-walk', category: 'walk', species: 'dog', emoji: '🦮', title: '강아지 산책용품', desc: '하네스·리드줄·산책가방', priceText: '인기', link: SEARCH('강아지 하네스 리드줄') },
  { id: 'dog-toy', category: 'walk', species: 'dog', emoji: '🎾', title: '노즈워크·산책 장난감', desc: '활동량·두뇌 자극 장난감', link: SEARCH('강아지 노즈워크 장난감') },
  { id: 'cat-walk', category: 'walk', species: 'cat', emoji: '🐈', title: '고양이 하네스·산책줄', desc: '안전한 외출용 하네스', link: SEARCH('고양이 하네스') },
  { id: 'cat-toy', category: 'walk', species: 'cat', emoji: '🪶', title: '고양이 사냥놀이 장난감', desc: '운동량 채우는 인터랙티브 토이', link: SEARCH('고양이 장난감 낚싯대') },
  // 건강
  { id: 'dog-dental', category: 'health', species: 'dog', emoji: '🦷', title: '강아지 구강케어', desc: '치약·덴탈껌·치석 관리', link: SEARCH('강아지 치약 덴탈') },
  { id: 'cat-dental', category: 'health', species: 'cat', emoji: '🦷', title: '고양이 구강·헤어볼 케어', desc: '덴탈·헤어볼 관리 용품', link: SEARCH('고양이 덴탈 헤어볼') },
  { id: 'health-checkup', category: 'health', emoji: '🩺', title: '가정용 건강검진 키트', desc: '소변·기생충 등 자가 점검', link: SEARCH('반려동물 건강검진 키트') },
  // 생활관리 (위생·미용)
  { id: 'dog-grooming', category: 'care', species: 'dog', emoji: '🧼', title: '강아지 미용·목욕용품', desc: '샴푸·발톱깎이·귀세정제', priceText: '인기', link: SEARCH('강아지 샴푸 미용용품') },
  { id: 'cat-grooming', category: 'care', species: 'cat', emoji: '🧴', title: '고양이 위생·미용용품', desc: '빗·발톱깎이·위생용품', link: SEARCH('고양이 미용 위생용품') },
  { id: 'potty-pad', category: 'care', emoji: '🚽', title: '배변패드·위생용품', desc: '패드·탈취·청소용품', link: SEARCH('강아지 배변패드') },
]

/** 종/맥락에 맞는 추천 상품을 반환한다. */
export function getAffiliateProducts(species: Species, context: AffiliateContext): AffiliateProduct[] {
  if (context === 'ad' || context === 'smart') return []
  const cats = CONTEXT_CATEGORIES[context]
  return CATALOG.filter(p => cats.includes(p.category) && (!p.species || p.species === species))
}

/** 전면 광고 소재로 쓸 추천 상품 하나를 반환한다 (종 정보가 있으면 우선 매칭). */
export function getAdCreativeProduct(species?: Species): AffiliateProduct {
  const pool = species ? CATALOG.filter(p => !p.species || p.species === species) : CATALOG
  const list = pool.length > 0 ? pool : CATALOG
  return list[Math.floor(Math.random() * list.length)]
}

/* ── 기록 기반 스마트 추천 ─────────────────────────────────────────────
 * 사용자의 실제 케어 기록을 신호로, "지금 필요한" 소모품을 맥락과 함께 추천한다.
 *  - 임박한 케어 일정(양치·미용·건강검진 등) → 해당 소모품을 미리 준비하도록
 *  - 꾸준한 식사 기록 → 사료가 떨어지기 전 재구매를 챙기도록
 * 단순 카테고리 노출과 달리 "왜 추천하는지(trigger)"를 함께 제공해 클릭률을 높인다. */

/** 추천이 뜬 이유. 표시 문구(i18n)는 화면단에서 trigger로 구성한다. */
export type SmartTrigger =
  | { type: 'careDue'; category: string; daysUntil: number }
  | { type: 'mealRoutine' }

export interface SmartRec {
  product: AffiliateProduct
  trigger: SmartTrigger
}

export interface CareDueItem {
  species: Species
  /** 기록 카테고리(예: 양치, 미용, 건강검진) */
  category: string
  /** 예정일까지 남은 일수 (D-day=0, 지난 건 음수) */
  daysUntil: number
}

export interface SmartRecInput {
  /** 임박한 케어 일정 목록 */
  dueSoon: CareDueItem[]
  /** 식사 기록 빈도(최근 7일) — 사료 재구매 신호 */
  meal?: { species: Species; logs7d: number }
}

/** 케어 일정 카테고리 → 추천할 상품(카테고리 + id 힌트) 매핑.
 *  처방이 필요한 항목(접종·심장사상충 등)은 커머스 추천 대상에서 제외한다. */
const CARE_PRODUCT_MAP: Record<string, { cat: ProductCategory; hint?: string }> = {
  양치: { cat: 'health', hint: 'dental' },
  건강검진: { cat: 'health', hint: 'checkup' },
  미용: { cat: 'care', hint: 'grooming' },
  목욕: { cat: 'care', hint: 'grooming' },
  발톱: { cat: 'care', hint: 'grooming' },
  귀청소: { cat: 'care', hint: 'grooming' },
}

/** (상품 카테고리, 종)에 맞는 상품 하나를 고른다. id 힌트가 있으면 우선 매칭. */
function pickProduct(cat: ProductCategory, species: Species, hint?: string): AffiliateProduct | undefined {
  const matches = CATALOG.filter(p => p.category === cat && (!p.species || p.species === species))
  if (hint) {
    const byHint = matches.find(p => p.id.includes(hint))
    if (byHint) return byHint
  }
  return matches[0]
}

/** 식사 루틴을 "꾸준함"으로 보는 최소 기록 수(최근 7일). */
export const MEAL_ROUTINE_MIN = 3

/**
 * 기록을 바탕으로 맞춤 제휴 추천을 만든다(최대 3개, 상품 중복 제거).
 * 순수 함수 — 입력만으로 결과가 결정되어 테스트가 쉽다.
 */
export function getSmartRecommendations(input: SmartRecInput): SmartRec[] {
  const recs: SmartRec[] = []
  const used = new Set<string>()
  const push = (product: AffiliateProduct | undefined, trigger: SmartTrigger) => {
    if (!product || used.has(product.id) || recs.length >= 3) return
    used.add(product.id)
    recs.push({ product, trigger })
  }

  // 1) 임박한 케어 일정 → 가까운 순으로 소모품 추천
  const sorted = [...input.dueSoon].sort((a, b) => a.daysUntil - b.daysUntil)
  for (const d of sorted) {
    const map = CARE_PRODUCT_MAP[d.category]
    if (!map) continue
    push(pickProduct(map.cat, d.species, map.hint), {
      type: 'careDue', category: d.category, daysUntil: d.daysUntil,
    })
  }

  // 2) 꾸준한 식사 기록 → 사료 재구매 루틴
  if (input.meal && input.meal.logs7d >= MEAL_ROUTINE_MIN) {
    push(pickProduct('food', input.meal.species), { type: 'mealRoutine' })
  }

  return recs
}

/** 제휴 태그가 설정돼 있으면 링크에 부착한다. */
export function buildAffiliateUrl(link: string): string {
  const tag = process.env.NEXT_PUBLIC_COUPANG_PARTNER_TAG
  if (!tag) return link
  try {
    const url = new URL(link)
    // 쿠팡 파트너스: lptag/trcid 형태. 실제 파라미터 규격은 가입 후 콘솔 안내를 따른다.
    url.searchParams.set('lptag', tag)
    return url.toString()
  } catch {
    return link
  }
}
