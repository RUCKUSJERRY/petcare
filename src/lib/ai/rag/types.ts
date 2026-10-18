import type { Species } from '@/types'

/**
 * RAG 공통 타입.
 *
 * 코퍼스는 앱이 이미 큐레이션한 한국어 콘텐츠(careGuide/foodGuide/symptomGuide/seasonalCare)다.
 * 외부 문서가 아니라 '우리 정보 페이지'를 근거로 쓰므로, 챗 답변을 앱과 일치시키고 환각을 줄인다.
 */

/** 코퍼스 문서(가이드 1개 단위) */
export interface RagDoc {
  id: string
  /** 'care' | 'food' | 'symptom' | 'seasonal' */
  source: string
  title: string
  /** 검색 대상 본문 */
  text: string
  /** 앱 내 더보기 링크(해당 정보 화면) */
  href: string
  metadata: {
    species?: Species | 'both'
    [k: string]: unknown
  }
}

/** 문서를 쪼갠 검색 단위(passage) */
export interface RagChunk {
  id: string
  docId: string
  source: string
  title: string
  text: string
  href: string
  metadata: RagDoc['metadata']
}

/** 점수가 달린 결과 */
export interface Scored<T> {
  item: T
  score: number
}
