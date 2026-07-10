'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useMyPets } from '@/hooks/useMyPets'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { cn } from '@/lib/utils'
import { PetAvatar } from './PetAvatar'
import { QuickLogBar } from '@/app/(dashboard)/pets/_components/QuickLogBar'
import { RecordFormModal } from '@/app/(dashboard)/pets/_components/RecordFormModal'
import { RecordsScanModal } from '@/app/(dashboard)/pets/_components/RecordsScanModal'
import { WeightSection } from '@/app/(dashboard)/pets/_components/WeightSection'

// FAB를 항상 숨길 화면 — 자체 하단 컨트롤이 있는 몰입형 화면
const HIDDEN_PREFIXES = ['/map', '/walks/track']

/**
 * 어느 화면에서든 떠 있는 '＋ 기록' 플로팅 버튼 + '오늘의 기록' 바텀시트.
 * - 탭하면 시트가 올라오고, 원탭 칩(식사·배변·투약 등)으로 바로 기록한다.
 * - 아이가 여러 마리면 시트 상단에서 대상 아이를 고를 수 있다.
 *   (아이가 1마리면 헤더에서 자동 선택되어 바로 기록 가능)
 * - 상세 입력(체중·직접·스캔)·오늘 기록 전체 보기로도 연결된다.
 */
export function QuickRecordFab() {
  const t = useTranslations('quickRecord')
  const tc = useTranslations('common')
  const pathname = usePathname()
  const { data: pets } = useMyPets()
  const { selectedPetId, setSelectedPetId } = useSelectedPet()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  // 상세 입력(체중·직접·스캔)은 페이지 이동 대신 현재 화면 위 모달로 연다 → 저장 후 원래 자리로 복귀.
  const [modal, setModal] = useState<null | 'weight' | 'manual' | 'scan'>(null)

  const afterRecord = () => {
    qc.invalidateQueries({ queryKey: ['today-timeline', selectedPetId] })
    qc.invalidateQueries({ queryKey: ['record-feed', selectedPetId] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
  }

  // 시트가 열려 있는 동안 배경 스크롤 잠금 + Esc 닫기
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const hidden = HIDDEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  const petList = pets ?? []
  // 등록된 아이가 없으면 기록할 대상이 없으므로 노출하지 않는다.
  if (hidden || petList.length === 0) return null

  const activeId = selectedPetId && petList.some(p => p.id === selectedPetId) ? selectedPetId : null

  // 홈(/dashboard)에서는 선택한 아이 요약 카드에 동일한 빠른 기록이 이미 인라인으로 있으므로
  // FAB이 중복 — 단, 아이가 선택된 경우에만 숨긴다. 다견 사용자가 아무 아이도 선택하지 않은
  // 상태(요약 카드 미표시)에서는 홈에 기록 진입점이 전혀 없으므로 FAB을 노출한다(바텀시트에 아이 선택 포함).
  if (pathname === '/dashboard' && activeId) return null

  const linkCls =
    'flex items-center justify-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 text-xs font-medium hover:bg-gray-100 transition-colors'

  return (
    <>
      {/* 플로팅 버튼 — 콘텐츠(max-w-lg) 우측 끝, 하단탭 위에 정렬 */}
      <div className="fixed inset-x-0 bottom-[4.75rem] z-40 pointer-events-none">
        <div className="max-w-lg mx-auto px-4 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('open')}
            data-tour="quick-record"
            className="pointer-events-auto w-14 h-14 rounded-full bg-primary-500 text-white shadow-lg shadow-primary-500/30 flex items-center justify-center hover:bg-primary-600 active:scale-95 transition-all"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* 바텀시트 */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('title')}
            className="bg-white w-full max-w-lg rounded-t-2xl p-4 pb-6 space-y-3 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-gray-200" />
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">{t('title')}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tc('close')}
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* 대상 아이 선택 (2마리 이상일 때) */}
            {petList.length > 1 && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">{t('pickPet')}</p>
                {/* 아이가 많으면 가로 스크롤 — 우측 페이드로 더 있음을 암시(QuickLogBar와 동일 패턴) */}
                <div className="relative">
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
                    {petList.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPetId(p.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 border transition-colors',
                          activeId === p.id
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary-300'
                        )}
                      >
                        <PetAvatar photoUrl={p.photo_url} species={p.species}
                          className="w-4 h-4" emojiClassName="text-sm leading-none" />
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-white to-transparent" />
                </div>
              </div>
            )}

            {/* 원탭 생활기록 */}
            <QuickLogBar
              petId={activeId}
              onLogged={() => qc.invalidateQueries({ queryKey: ['today-timeline', activeId] })}
            />

            {/* 상세 입력 — 대상 아이가 정해졌을 때만. 페이지 이동 대신 모달로 연다. */}
            {activeId && (
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <button type="button" onClick={() => { setOpen(false); setModal('weight') }} className={linkCls}>
                  <span aria-hidden>⚖️</span> {t('weight')}
                </button>
                <button type="button" onClick={() => { setOpen(false); setModal('manual') }} className={linkCls}>
                  <span aria-hidden>📝</span> {t('manual')}
                </button>
                <button type="button" onClick={() => { setOpen(false); setModal('scan') }} className={linkCls}>
                  <span aria-hidden>📷</span> {t('scan')}
                </button>
              </div>
            )}

            <Link
              href={activeId ? `/schedule?pet=${activeId}&view=today` : '/schedule?view=today'}
              onClick={() => setOpen(false)}
              className="block text-center text-sm text-primary-600 font-semibold pt-1"
            >
              {t('viewToday')} ›
            </Link>
          </div>
        </div>
      )}

      {/* 상세 입력 모달 — 현재 화면 위에 떠서 저장 후 원래 자리로 복귀한다 */}
      {modal === 'scan' && activeId && (
        <RecordsScanModal petId={activeId} onClose={() => { setModal(null); afterRecord() }} />
      )}
      {/* 직접 기록: 헤더 저장 버튼이 임베드 폼을 구동하는 공용 모달(이중 헤더 제거) */}
      {modal === 'manual' && activeId && (
        <RecordFormModal
          petId={activeId}
          title={t('manual')}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); afterRecord() }}
        />
      )}
      {modal === 'weight' && activeId && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center"
          onClick={() => setModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900">{t('weight')}</p>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label={tc('close')}
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <WeightSection petId={activeId} defaultOpen />
          </div>
        </div>
      )}
    </>
  )
}
