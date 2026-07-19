'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { careCategoryIcon } from '@/lib/utils'
import { deleteImageByUrl } from '@/lib/upload'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { RecordForm, type RecordFormHandle } from './RecordForm'
import type { PetRecord } from '@/types'

/**
 * 기록 상세/수정 모달 — 한 건을 터치하면 바로 수정 가능한 폼을 연다.
 * (별도 '상세 보기 → 수정' 2단계 없이 즉시 편집. 삭제는 헤더에서.)
 */
export function RecordDetailModal({
  recordId, onClose, onChanged,
}: {
  recordId: string
  onClose: () => void
  onChanged?: () => void
}) {
  const t = useTranslations('records')
  const tc = useTranslations('common')
  const supabase = createClient()
  const qc = useQueryClient()
  const [confirmDel, setConfirmDel] = useState(false)
  const [delError, setDelError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // 상세(진료·미용·식사) 로드 전에는 저장이 조용히 무시되므로, 로드 완료까지 저장 버튼을 잠근다.
  const [ready, setReady] = useState(false)
  const formRef = useRef<RecordFormHandle>(null)

  const { data: record } = useQuery({
    queryKey: ['record', recordId],
    queryFn: async () => {
      const { data } = await supabase.from('records').select('*').eq('id', recordId).maybeSingle()
      return (data ?? null) as PetRecord | null
    },
  })

  const afterChange = () => {
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
    if (record) {
      qc.invalidateQueries({ queryKey: ['records', record.pet_id] })
      qc.invalidateQueries({ queryKey: ['today-log', record.pet_id] })
      qc.invalidateQueries({ queryKey: ['today-timeline', record.pet_id] })
      qc.invalidateQueries({ queryKey: ['record-feed', record.pet_id] })
    }
    // 전체(아이 미선택) 타임라인·피드도 갱신
    qc.invalidateQueries({ queryKey: ['today-timeline', null] })
    qc.invalidateQueries({ queryKey: ['record-feed', null] })
    qc.invalidateQueries({ queryKey: ['record', recordId] })
    onChanged?.()
  }

  const remove = async () => {
    if (!record) return
    // 삭제 실패(RLS 등)를 확인하지 않고 이미지를 지우면, 기록은 남고 사진만 사라져
    // 영구적으로 깨진 이미지가 된다. 삭제가 성공한 뒤에만 이미지를 정리한다.
    const { error } = await supabase.from('records').delete().eq('id', record.id)
    if (error) { setDelError(t('errDeleteFailed')); return }
    const imgs = record.photo_urls?.length ? record.photo_urls : (record.photo_url ? [record.photo_url] : [])
    imgs.forEach(deleteImageByUrl)
    afterChange()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 헤더: 닫기 · (제목) · 삭제 · 저장 */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onClose} aria-label={tc('close')} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 shrink-0">✕</button>
            <h2 className="font-bold text-gray-900 flex items-center gap-1.5 min-w-0">
              {record ? (
                <>
                  <span aria-hidden>{careCategoryIcon(record.category)}</span>
                  <span className="truncate">{record.category}</span>
                </>
              ) : t('editTitle')}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {record && (
              <>
                <button
                  onClick={() => { setDelError(null); setConfirmDel(true) }}
                  aria-label={tc('delete')}
                  className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                >🗑</button>
                <button
                  onClick={() => formRef.current?.submit()}
                  disabled={saving || !ready}
                  className="btn-primary text-sm py-1.5 px-4 disabled:opacity-60"
                >{saving ? tc('saving') : tc('save')}</button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!record ? (
            <p className="text-sm text-gray-400 text-center py-8">{tc('saving')}</p>
          ) : (
            <RecordForm
              ref={formRef}
              petId={record.pet_id}
              record={record}
              embedded
              onSavingChange={setSaving}
              onReadyChange={setReady}
              onDone={() => { afterChange(); onClose() }}
              onCancel={onClose}
            />
          )}
        </div>
      </div>

      {confirmDel && record && (
        <ConfirmModal
          title={t('deleteConfirm')}
          description={delError ?? undefined}
          confirmLabel={tc('delete')}
          destructive
          onConfirm={remove}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  )
}
