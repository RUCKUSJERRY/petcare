import type { Species } from '@/types'

/**
 * 제휴(어필리에이트) 상품 카탈로그 + 클릭 추적.
 *
 * 수익 모델(B): 사료 계산기·음식 가이드 등 자연스러운 맥락에 추천 상품을 노출하고,
 * 제휴 링크를 통해 구매가 발생하면 수수료를 받는다(예: 쿠팡 파트너스).
 *
 * 실제 제휴 ID/링크는 코드에 하드코딩하지 않고 환경변수로 주입한다.
 *  - NEXT_PUBLIC_COUPANG_PARTNER_TAG : 쿠팡 파트너스 트래킹 태그(예: AF1234567)
 * 미설정 시에는 상품의 기본 link(검색/랜딩)를 그대로 사용한다.
 */

export type AffiliateContext = 'feed' | 'foods' | 'ad'

export interface AffiliateProduct {
  id: string
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

/**
 * MVP 카탈로그. 실제 운영 시에는 DB/CMS로 옮겨 관리할 수 있다.
 * link 는 제휴 랜딩(검색 결과 등)으로, 파트너 태그가 있으면 자동 부착된다.
 */
const CATALOG: AffiliateProduct[] = [
  {
    id: 'dog-food-premium',
    species: 'dog',
    emoji: '🦴',
    title: '강아지 사료 추천 모음',
    desc: '연령·체중별 베스트 건사료를 비교해 보세요',
    priceText: '특가',
    link: 'https://www.coupang.com/np/search?q=강아지+사료',
  },
  {
    id: 'cat-food-premium',
    species: 'cat',
    emoji: '🐟',
    title: '고양이 사료 추천 모음',
    desc: '기호성 좋은 인기 건사료를 한눈에',
    priceText: '특가',
    link: 'https://www.coupang.com/np/search?q=고양이+사료',
  },
  {
    id: 'dog-supplement',
    species: 'dog',
    emoji: '💊',
    title: '강아지 영양제·관절 보조제',
    desc: '관절·피부·장 건강 보조제 인기 상품',
    link: 'https://www.coupang.com/np/search?q=강아지+영양제',
  },
  {
    id: 'cat-supplement',
    species: 'cat',
    emoji: '💊',
    title: '고양이 영양제·헤어볼 케어',
    desc: '헤어볼·관절·영양 보조제 인기 상품',
    link: 'https://www.coupang.com/np/search?q=고양이+영양제',
  },
]

/** 종/맥락에 맞는 추천 상품을 반환한다. */
export function getAffiliateProducts(species: Species, context: AffiliateContext): AffiliateProduct[] {
  const isSupplement = (p: AffiliateProduct) => p.id.includes('supplement')
  return CATALOG.filter(p => {
    if (p.species && p.species !== species) return false
    // 사료 계산기 맥락은 사료를, 음식 가이드 맥락은 영양제를 우선 노출
    return context === 'feed' ? !isSupplement(p) : isSupplement(p)
  })
}

/** 전면 광고 소재로 쓸 추천 상품 하나를 반환한다 (종 정보가 있으면 우선 매칭). */
export function getAdCreativeProduct(species?: Species): AffiliateProduct {
  const pool = species ? CATALOG.filter(p => !p.species || p.species === species) : CATALOG
  const list = pool.length > 0 ? pool : CATALOG
  return list[Math.floor(Math.random() * list.length)]
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
