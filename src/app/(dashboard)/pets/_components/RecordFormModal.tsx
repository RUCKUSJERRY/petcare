'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { RecordForm, type RecordFormHandle } from './RecordForm'

/**
 * 직접 기록 입력 모달 — 임베드 폼(embedded)을 헤더의 저장 버튼이 구동한다.
 * 모달 자체 헤더와 폼 자체 헤더가 겹쳐 '이중 제목·이중 취소'가 되던 문제를 없애기 위해,
 * 홈 요약카드·상세페이지·플로팅 빠른기록이 이 하나의 모달을 공용으로 쓴다.
 * (기존 RecordDetailModal 의 헤더+embedded 폼 패턴과 동일한 구조)
 */
export function RecordFormModal({
  petId, title, onClose, onDone, allowPetSelect = false,
}: {
  petId: string | null
  title: string
  onClose: () => void
  onDone: () => void
  /** 대상 아이가 고정되지 않은 화면(예: 비용 '전체 보기')에서 폼 안에서 아이를 고르게 한다 */
  allowPetSelect?: boolean
}) {
  const tc = useTranslations('common')
  const formRef = useRef<RecordFormHandle>(null)
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onClose} aria-label={tc('close')} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 shrink-0">✕</button>
            <h2 className="font-bold text-gray-900 truncate">{title}</h2>
          </div>
          <button
            onClick={() => formRef.current?.submit()}
            disabled={saving}
            className="btn-primary text-sm py-1.5 px-4 shrink-0"
          >
            {saving ? tc('saving') : tc('save')}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <RecordForm
            ref={formRef}
            petId={petId}
            allowPetSelect={allowPetSelect}
            embedded
            onSavingChange={setSaving}
            onDone={onDone}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  )
}
