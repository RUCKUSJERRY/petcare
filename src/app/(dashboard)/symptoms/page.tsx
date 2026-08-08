'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { symptomGuidesForSpecies, symptomGuideMatches } from '@/lib/symptomGuide'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionTabs } from '@/components/ui/SectionTabs'
import { GuideSearchInput } from '@/components/ui/GuideSearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import type { Pet } from '@/types'

/**
 * 증상별 대처 화면 — "지금 토했는데/설사하는데 어떡하지?"를 위한 정보 허브.
 * 예방 중심의 건강 체크리스트와 달리 '증상 발생 후 대응'(관찰·적신호·병원 기준)을 다룬다.
 * 선택된 아이가 있으면 그 종에 맞는 증상만, 없으면 전체를 보여준다.
 */
export default function SymptomsPage() {
  const t = useTranslations('symptoms')
  const { selectedPetId } = useSelectedPet()
  const { data: petsAll } = useMyPets()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const nq = query.trim().toLowerCase()

  const activePet: Pet | null = selectedPetId ? (petsAll ?? []).find(p => p.id === selectedPetId) ?? null : null
  const guides = symptomGuidesForSpecies(activePet?.species ?? null).filter(g => symptomGuideMatches(g, nq))

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t('title')} />
        {activePet && (
          <span className="text-sm text-primary-600 font-medium shrink-0">
            {activePet.species === 'cat' ? '🐱' : '🐶'} {t('petBasis', { name: activePet.name })}
          </span>
        )}
      </div>

      <SectionTabs section="info" />

      {/* 응급 안내 + 일반정보 디스클레이머 — 가장 먼저, 눈에 띄게 */}
      <div className="rounded-lg bg-red-50 border border-red-100 p-3 space-y-1">
        <p className="text-sm font-semibold text-red-700">🚨 {t('emergencyTitle')}</p>
        <p className="text-xs text-red-600/90 leading-relaxed">{t('emergencyDesc')}</p>
      </div>
      <div className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-3">
        {t('disclaimer')}
      </div>

      <GuideSearchInput value={query} onChange={setQuery} placeholder={t('searchPlaceholder')} />

      {guides.length === 0 ? (
        <EmptyState
          icon="🔎"
          title={t('searchEmpty')}
          action={
            <button onClick={() => setQuery('')} className="btn-primary text-sm py-1.5 px-4">
              {t('searchReset')}
            </button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {guides.map(g => {
            const open = openId === g.id
            return (
              <div key={g.id} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : g.id)}
                  aria-expanded={open}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <span className="text-2xl shrink-0" aria-hidden>{g.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900">{g.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{g.summary}</p>
                  </div>
                  <span className={cn('text-gray-300 transition-transform shrink-0', open && 'rotate-180')} aria-hidden>⌄</span>
                </button>

                {open && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                    <Block title={t('watchTitle')} icon="👀" items={g.watch} />
                    <Block title={t('redFlagsTitle')} icon="🚨" items={g.redFlags} tone="danger" />
                    <div className="rounded-lg bg-primary-50 p-2.5">
                      <p className="text-xs font-semibold text-primary-700">🏥 {t('vetWhenTitle')}</p>
                      <p className="text-xs text-primary-700/90 leading-relaxed mt-0.5">{g.vetWhen}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-center text-xs text-gray-400 pt-1">
        <Link href="/health" className="text-primary-600 font-medium">{t('healthLink')}</Link>
      </p>
    </div>
  )
}

function Block({ title, icon, items, tone = 'plain' }: {
  title: string; icon: string; items: string[]; tone?: 'plain' | 'danger'
}) {
  return (
    <div>
      <p className={cn('text-xs font-semibold mb-1.5', tone === 'danger' ? 'text-red-600' : 'text-gray-700')}>
        <span aria-hidden>{icon}</span> {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-xs text-gray-600 leading-relaxed">
            <span className={cn('shrink-0', tone === 'danger' ? 'text-red-400' : 'text-gray-300')} aria-hidden>•</span>
            <span className="min-w-0">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
