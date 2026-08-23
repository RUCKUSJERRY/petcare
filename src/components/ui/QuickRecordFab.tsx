'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useMyPets } from '@/hooks/useMyPets'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useStickyBanner } from '@/contexts/StickyBannerContext'
import { useTour } from '@/contexts/TourContext'
import { cn } from '@/lib/utils'
import { PetAvatar } from './PetAvatar'
import { QuickLogBar } from '@/app/(dashboard)/pets/_components/QuickLogBar'
import { RecordEntryModals } from '@/app/(dashboard)/pets/_components/RecordEntryModals'
import { QuickCostModal } from '@/app/(dashboard)/costs/_components/QuickCostModal'
import { RecordFormModal } from '@/app/(dashboard)/pets/_components/RecordFormModal'
import type { RecordCategory } from '@/types'

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
  const tCosts = useTranslations('costs')
  const tc = useTranslations('common')
  const pathname = usePathname()
  const { data: pets } = useMyPets()
  const { selectedPetId, setSelectedPetId, hydrated } = useSelectedPet()
  const { visible: bannerVisible } = useStickyBanner()
  const { tourActive } = useTour()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  // 상세 입력(체중·직접·스캔·비용)은 페이지 이동 대신 현재 화면 위 모달로 연다 → 저장 후 원래 자리로 복귀.
  // 'cost' 는 비용 빠른입력, 'cost-detail' 은 거기서 '자세히 입력'으로 넘어온 전체 폼(비용 페이지와 동일 흐름).
  const [modal, setModal] = useState<null | 'weight' | 'manual' | 'scan' | 'cost' | 'cost-detail'>(null)
  // 비용 빠른입력 → 자세히 입력 전환 시 이미 고른 금액·항목·날짜를 전체 폼에 이어받게 한다.
  const [costDraft, setCostDraft] = useState<{ amount: string; category: RecordCategory; date: string } | null>(null)

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
  // 선택 복원 전(hydrated=false)에는 홈에서 FAB이 잠깐 떴다가 요약카드 인라인 기록과 겹쳐
  // 사라지는 깜빡임이 있어, 복원이 끝날 때까지 렌더를 미룬다.
  if (hidden || petList.length === 0 || !hydrated) return null

  const activeId = selectedPetId && petList.some(p => p.id === selectedPetId) ? selectedPetId : null

  // 온보딩 투어 중에는 아래 '중복이라 숨김' 규칙을 건너뛴다 — 투어의 '＋기록' 단계가
  // 이 FAB([data-tour="quick-record"])을 스포트라이트로 짚는데, 최초 투어는 첫 아이 등록 직후
  // 홈/아이 상세에서 열려 정작 이 화면들에서 FAB이 숨어 단계가 건너뛰어졌다. 투어 종료 후엔 다시 숨는다.
  if (!tourActive) {
    // 홈(/dashboard)에서는 선택한 아이 요약 카드에 동일한 빠른 기록이 이미 인라인으로 있으므로
    // FAB이 중복 — 단, 아이가 선택된 경우에만 숨긴다. 다견 사용자가 아무 아이도 선택하지 않은
    // 상태(요약 카드 미표시)에서는 홈에 기록 진입점이 전혀 없으므로 FAB을 노출한다(바텀시트에 아이 선택 포함).
    if (pathname === '/dashboard' && activeId) return null

    // 아이 상세(/pets/[id])도 동일한 원탭 기록 UI(QuickLogBar+직접기록+스캔)를 카드로 인라인 제공하고,
    // 이 페이지는 보고 있는 아이가 고정돼 있다. 여기서 FAB 시트를 열면 (선택 아이가 상세의 아이와
    // 다르면) 엉뚱한 아이로 기록될 여지가 있고 진입점도 중복 — /dashboard 와 같은 취지로 숨긴다.
    // 목록(/pets)·신규(/pets/new)는 인라인 기록이 없으므로 제외.
    if (/^\/pets\/[^/]+$/.test(pathname) && pathname !== '/pets/new') return null
  }

  const linkCls =
    'flex items-center justify-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 text-xs font-medium hover:bg-gray-100 transition-colors'

  return (
    <>
      {/* 플로팅 버튼 — 콘텐츠(max-w-lg) 우측 끝, 하단탭 위에 정렬.
          하단 고정 제휴 배너가 떠 있는 화면에서는 배너 위로 올려 겹침(가격·닫기 가림)을 피한다.
          (safe-area 를 함께 더해 노치 기기에서도 배너보다 항상 위에 오도록) */}
      <div
        className="fixed inset-x-0 bottom-[4.75rem] z-40 pointer-events-none"
        style={bannerVisible ? { bottom: 'calc(8.5rem + env(safe-area-inset-bottom, 0px))' } : undefined}
      >
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

            {/* 상세 입력 — 대상 아이가 정해졌을 때만. 페이지 이동 대신 모달로 연다.
                비용은 다른 기록과 동일하게 records 한 건이지만, 예전엔 이 시트에 진입점이 없어
                지출을 남기려면 더보기→비용→＋기록으로 3~4번을 눌러야 했다. 매일 쓰는 지출 기록을
                다른 기록처럼 어느 화면에서든 한 번에 남길 수 있도록 타일을 추가한다(사용성 개선). */}
            {activeId && (
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button type="button" onClick={() => { setOpen(false); setModal('cost') }} className={linkCls}>
                  <span aria-hidden>🧾</span> {t('cost')}
                </button>
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

      {/* 상세 입력 모달(체중·직접·스캔) — 현재 화면 위에 떠서 저장 후 원래 자리로 복귀 (공용 컴포넌트) */}
      {activeId && (
        <RecordEntryModals
          petId={activeId}
          modal={modal === 'weight' || modal === 'manual' || modal === 'scan' ? modal : null}
          manualTitle={t('manual')}
          weightTitle={t('weight')}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); afterRecord() }}
        />
      )}

      {/* 비용 빠른입력 — 저장 시 필요한 캐시 무효화는 QuickCostModal 이 자체적으로 수행한다.
          비용 페이지와 동일하게 '자세히 입력'은 프리필된 전체 폼(cost-detail)으로 전환한다. */}
      {activeId && modal === 'cost' && (
        <QuickCostModal
          petId={activeId}
          onClose={() => setModal(null)}
          onDone={() => setModal(null)}
          onDetail={(draft) => { setCostDraft(draft); setModal('cost-detail') }}
        />
      )}
      {activeId && modal === 'cost-detail' && (
        <RecordFormModal
          petId={activeId}
          title={tCosts('addRecord')}
          defaultCategory={costDraft?.category}
          defaultDate={costDraft?.date}
          defaultCost={costDraft?.amount || undefined}
          onClose={() => { setModal(null); setCostDraft(null) }}
          onDone={() => { setModal(null); setCostDraft(null); afterRecord(); qc.invalidateQueries({ queryKey: ['cost-records'] }) }}
        />
      )}
    </>
  )
}
