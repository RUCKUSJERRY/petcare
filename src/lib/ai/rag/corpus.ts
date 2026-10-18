import { CARE_GUIDES } from '@/lib/careGuideData'
import { foodGuidesForSpecies } from '@/lib/foodGuideData'
import { SYMPTOM_GUIDES } from '@/lib/symptomGuide'
import { seasonalCareFor } from '@/lib/seasonalCare'
import type { RagDoc } from './types'

/**
 * 앱 큐레이션 콘텐츠 > RAG 문서. 각 가이드 1개 = 문서 1개(제목 + 본문 평문화).
 * 순수·결정적(현재시각·무작위 미사용). 계절 콘텐츠는 12개월 전부를 포함해 질의 시점과 무관하게 색인.
 */

/** 돌봄 가이드 > 문서. notes/steps/tips 를 한 본문으로 평문화. */
function careDocs(): RagDoc[] {
  return CARE_GUIDES.map(g => {
    const parts = [
      `주기: ${g.frequency}`,
      ...g.notes.map(n => `[${n.stage}${n.size ? `·${n.size}` : ''}] ${n.text}`),
      ...(g.steps ?? []).map(s => `단계: ${s}`),
      ...(g.tips ?? []).map(t => `팁: ${t}`),
    ]
    return {
      id: `care:${g.id}`,
      source: 'care',
      title: g.topic,
      text: `${g.topic}\n${parts.join('\n')}`,
      href: '/care',
      metadata: { species: g.species, topic: g.topic },
    }
  })
}

/** 사료·급여 가이드 > 문서(강아지·고양이 각각). points 를 본문으로. */
function foodDocs(): RagDoc[] {
  const docs: RagDoc[] = []
  for (const species of ['dog', 'cat'] as const) {
    for (const g of foodGuidesForSpecies(species)) {
      docs.push({
        id: `food:${species}:${g.id}`,
        source: 'food',
        title: g.title,
        text: `${g.title}\n${g.points.join('\n')}`,
        href: '/foods',
        metadata: { species, topic: g.title },
      })
    }
  }
  return docs
}

/** 증상 대처 가이드 > 문서. summary/watch/redFlags/vetWhen 평문화. */
function symptomDocs(): RagDoc[] {
  return SYMPTOM_GUIDES.map(g => ({
    id: `symptom:${g.id}`,
    source: 'symptom',
    title: g.title,
    text: [
      g.title,
      g.summary,
      ...g.watch.map(w => `관찰: ${w}`),
      ...g.redFlags.map(r => `위험신호: ${r}`),
      `병원 판단: ${g.vetWhen}`,
    ].join('\n'),
    href: '/symptoms',
    metadata: { species: g.species, topic: g.title },
  }))
}

/** 계절 케어 > 문서(종 x 계절). 대표 월(2/5/8/11)로 4계절을 모두 색인. */
function seasonalDocs(): RagDoc[] {
  const docs: RagDoc[] = []
  const months = [2, 5, 8, 11] // 겨울·봄·여름·가을 대표
  for (const species of ['dog', 'cat'] as const) {
    for (const m of months) {
      const s = seasonalCareFor(species, m)
      docs.push({
        id: `seasonal:${species}:${s.season}`,
        source: 'seasonal',
        title: `${s.label} 케어`,
        text: `${s.label} 케어\n${s.points.join('\n')}`,
        href: '/health',
        metadata: { species, topic: `${s.label} 케어`, season: s.season },
      })
    }
  }
  return docs
}

/** 전체 코퍼스(결정적 순서). */
export function buildCorpus(): RagDoc[] {
  return [...careDocs(), ...foodDocs(), ...symptomDocs(), ...seasonalDocs()]
}
