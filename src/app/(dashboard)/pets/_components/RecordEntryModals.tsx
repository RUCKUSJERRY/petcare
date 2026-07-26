'use client'

import { useTranslations } from 'next-intl'
import { WeightSection } from './WeightSection'
import { RecordFormModal } from './RecordFormModal'
import { RecordsScanModal } from './RecordsScanModal'

export type RecordEntryModalKind = 'weight' | 'manual' | 'scan'

/**
 * 상세 기록 입력 모달(체중·직접입력·영수증 스캔)의 공용 렌더러.
 *
 * 홈 요약 카드(SelectedPetSummary)·전역 FAB(QuickRecordFab)·아이 상세(pets/[id])가
 * 동일한 모달 3종을 각각 복붙해 쓰던 것을 하나로 모은다. 현재 화면 위에 떠서 저장 후
 * 원래 자리로 복귀하는 동작은 그대로 유지한다.
 *
 * - modal=null 이면 아무것도 렌더하지 않는다.
 * - onClose : 저장 없이 닫기(취소). weight 시트 닫기·직접입력 취소에 사용.
 * - onSaved : 저장/스캔 완료 후 닫기 + 상위 캐시 갱신. (호출부의 afterRecord 를 포함해 전달)
 *   스캔 모달은 완료 시 onClose 콜백으로 닫히므로 onSaved 를 연결한다.
 * - weight 모달은 WeightSection 이 저장 시 자체적으로 관련 캐시를 무효화하므로 닫기만 한다.
 */
export function RecordEntryModals({
  petId,
  modal,
  manualTitle,
  weightTitle,
  onClose,
  onSaved,
}: {
  petId: string
  modal: RecordEntryModalKind | null
  /** 직접입력 모달 제목 (화면별 문구가 달라 주입받는다) */
  manualTitle: string
  /** 체중 모달 제목 (weight 모달을 쓰지 않는 화면은 생략 가능) */
  weightTitle?: string
  onClose: () => void
  onSaved: () => void
}) {
  const tc = useTranslations('common')

  if (!modal) return null

  return (
    <>
      {modal === 'scan' && (
        <RecordsScanModal petId={petId} onClose={onSaved} />
      )}

      {/* 직접 기록: 헤더 저장 버튼이 임베드 폼을 구동하는 공용 모달(이중 헤더 제거) */}
      {modal === 'manual' && (
        <RecordFormModal
          petId={petId}
          title={manualTitle}
          onClose={onClose}
          onDone={onSaved}
        />
      )}

      {modal === 'weight' && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900">{weightTitle}</p>
              <button
                type="button"
                onClick={onClose}
                aria-label={tc('close')}
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <WeightSection petId={petId} defaultOpen />
          </div>
        </div>
      )}
    </>
  )
}
