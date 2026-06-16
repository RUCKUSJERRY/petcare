'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { careCategoryIcon, ddayBadge, ddayToneClass } from '@/lib/utils'
import { CATEGORY_CONFIG, DETAIL_TABLE } from '@/lib/records'
import { describeRule, parseRule } from '@/lib/recurrence'
import { deleteImageByUrl } from '@/lib/upload'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { RecordForm } from './RecordForm'
import type { PetRecord } from '@/types'

const won = (n: number) => n.toLocaleString('ko-KR') + '원'

/**
 * 기록 상세 보기 모달 — 일정(캘린더/목록/검색)에서 한 건을 터치하면
 * 그 기록의 정보만 보여준다. 수정/삭제 가능. (아이 프로필로 이동하지 않음)
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
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const { data: record } = useQuery({
    queryKey: ['record', recordId],
    queryFn: async () => {
      const { data } = await supabase.from('records').select('*').eq('id', recordId).maybeSingle()
      return (data ?? null) as PetRecord | null
    },
  })

  const hasDetail = record ? !!DETAIL_TABLE[record.category] : false
  const { data: detail } = useQuery({
    queryKey: ['record-detail', recordId],
    enabled: hasDetail && !!record,
    queryFn: async () => {
      const table = DETAIL_TABLE[record!.category]!
      const { data } = await supabase.from(table).select('*').eq('record_id', recordId).maybeSingle()
      return (data ?? {}) as Record<string, string | null>
    },
  })

  const afterChange = () => {
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
    if (record) qc.invalidateQueries({ queryKey: ['records', record.pet_id] })
    qc.invalidateQueries({ queryKey: ['record', recordId] })
    onChanged?.()
  }

  const remove = async () => {
    if (!record) return
    await supabase.from('records').delete().eq('id', record.id)
    const imgs = record.photo_urls?.length ? record.photo_urls : (record.photo_url ? [record.photo_url] : [])
    imgs.forEach(deleteImageByUrl)
    afterChange()
    onClose()
  }

  const rule = record ? parseRule(record.recur_rule) : null
  const badge = record?.next_due_on ? ddayBadge(record.next_due_on) : null
  const photos = record ? (record.photo_urls?.length ? record.photo_urls : (record.photo_url ? [record.photo_url] : [])) : []

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{editing ? t('editTitle') : t('detailTitle')}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!record ? (
            <p className="text-sm text-gray-400 text-center py-8">{tc('saving')}</p>
          ) : editing ? (
            <RecordForm
              petId={record.pet_id}
              record={record}
              onDone={() => { setEditing(false); afterChange() }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {careCategoryIcon(record.category)} {record.category}
                </span>
                {badge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ddayToneClass(badge.tone)}`}>{badge.text}</span>
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900">{record.title}</h3>

              <dl className="text-sm text-gray-600 space-y-1">
                <Row label={t('date')} value={record.event_on} />
                {record.place_name && <Row label={t('placeLabel')} value={`📍 ${record.place_name}`} />}
                {record.cost != null && <Row label={t('cost')} value={won(record.cost)} />}
                {record.next_due_on && <Row label={t('nextDue')} value={record.next_due_on + (rule ? ` · 🔁 ${describeRule(rule, record.event_on)}` : '')} />}
                {hasDetail && CATEGORY_CONFIG[record.category].fields.map(f => (
                  detail?.[f.key] ? <Row key={f.key} label={f.label} value={detail[f.key] as string} /> : null
                ))}
              </dl>

              {record.memo && <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-2">{record.memo}</p>}

              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((u, i) => (
                    <ImageLightbox key={i} src={u} alt={record.title}
                      className="w-20 h-20 rounded-lg object-cover border border-gray-100" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {record && !editing && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
            {confirmDel ? (
              <>
                <span className="text-sm text-gray-500 flex-1">{t('deleteConfirm')}</span>
                <button onClick={remove} className="text-sm text-red-500 font-semibold px-3 py-1.5">{tc('delete')}</button>
                <button onClick={() => setConfirmDel(false)} className="text-sm text-gray-400 px-3 py-1.5">{tc('cancel')}</button>
              </>
            ) : (
              <>
                <button onClick={() => setConfirmDel(true)} className="text-sm text-red-500 px-3 py-1.5">{tc('delete')}</button>
                <button onClick={() => setEditing(true)} className="btn-primary text-sm py-1.5 px-4 ml-auto">{tc('edit')}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-gray-400 shrink-0 w-20">{label}</dt>
      <dd className="text-gray-700 flex-1">{value}</dd>
    </div>
  )
}
