'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { careCategoryIcon, ddayBadge, ddayToneClass } from '@/lib/utils'
import { deleteImageByUrl } from '@/lib/upload'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { CATEGORY_CONFIG, DETAIL_TABLE, RECORD_CATEGORIES } from '@/lib/records'
import { describeRule, parseRule } from '@/lib/recurrence'
import { RecordForm } from './RecordForm'
import type { PetRecord, RecordCategory } from '@/types'

const won = (n: number) => n.toLocaleString('ko-KR') + '원'

/** 한 기록 행 — 공통 컬럼만 표시하고, '상세'를 누르면 상세 테이블을 lazy 조회 */
function RecordRow({
  r, onEdit, onDeleted,
}: {
  r: PetRecord
  onEdit: () => void
  onDeleted: () => void
}) {
  const t = useTranslations('records')
  const tc = useTranslations('common')
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const hasDetail = !!DETAIL_TABLE[r.category]
  const badge = r.next_due_on ? ddayBadge(r.next_due_on) : null

  const { data: detail } = useQuery({
    queryKey: ['record-detail', r.id],
    enabled: open && hasDetail,
    queryFn: async () => {
      const table = DETAIL_TABLE[r.category]!
      const { data } = await supabase.from(table).select('*').eq('record_id', r.id).maybeSingle()
      return (data ?? {}) as Record<string, string | null>
    },
  })

  const remove = async () => {
    await supabase.from('records').delete().eq('id', r.id)
    if (r.photo_url) deleteImageByUrl(r.photo_url)
    setConfirmDel(false)
    onDeleted()
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium shrink-0">
          {careCategoryIcon(r.category)} {r.category}
        </span>
        <span className="font-semibold text-sm text-gray-900 truncate">{r.title}</span>
        {confirmDel ? (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500">{t('deleteConfirm')}</span>
            <button onClick={remove} className="text-xs text-red-500 font-semibold">{tc('delete')}</button>
            <button onClick={() => setConfirmDel(false)} className="text-xs text-gray-400">{tc('cancel')}</button>
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button onClick={onEdit} className="text-xs text-gray-300 hover:text-primary-600">{tc('edit')}</button>
            <button onClick={() => setConfirmDel(true)} className="text-xs text-gray-300 hover:text-red-500" aria-label={t('deleteAria')}>{tc('delete')}</button>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500">
        {t('performedAt', { date: r.event_on })}
        {r.place_name && ` · 📍 ${r.place_name}`}
        {r.cost != null && ` · 💳 ${won(r.cost)}`}
      </div>

      {r.memo && <p className="text-xs text-gray-400 whitespace-pre-wrap">{r.memo}</p>}

      {badge && (
        <div className="flex items-center gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ddayToneClass(badge.tone)}`}>{badge.text}</span>
          <span className="text-xs text-gray-400">
            {t('nextScheduled', { date: r.next_due_on! })}
            {r.recur_rule ? ` · 🔁 ${describeRule(parseRule(r.recur_rule), r.event_on)}` : ''}
          </span>
        </div>
      )}

      {(r.photo_urls?.length ? r.photo_urls : (r.photo_url ? [r.photo_url] : [])).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(r.photo_urls?.length ? r.photo_urls : [r.photo_url!]).map((u, i) => (
            <ImageLightbox key={i} src={u} alt={r.title}
              className="w-16 h-16 rounded-lg object-cover border border-gray-100" />
          ))}
        </div>
      )}

      {/* 상세 (있을 때만, 진입 시 조회) */}
      {hasDetail && (
        <>
          <button onClick={() => setOpen(o => !o)} className="text-xs text-primary-600 font-medium">
            {open ? '상세 닫기' : '상세 보기'}
          </button>
          {open && detail && (
            <div className="rounded-lg bg-gray-50 p-2 space-y-0.5">
              {CATEGORY_CONFIG[r.category].fields.map(f => (
                detail[f.key] ? (
                  <p key={f.key} className="text-xs text-gray-600">
                    <span className="text-gray-400">{f.label}: </span>{detail[f.key]}
                  </p>
                ) : null
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * 통합 기록 섹션 (아이 상세). 진료·접종·미용·식사 등 모든 기록을 한 곳에서.
 * 목록은 공통 컬럼만 조회하고, 상세는 행을 펼칠 때 lazy 조회한다.
 */
export function RecordsSection({ petId, defaultOpen = false, onScan }: { petId: string; defaultOpen?: boolean; onScan?: () => void }) {
  const t = useTranslations('records')
  const tc = useTranslations('common')
  const supabase = createClient()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(defaultOpen)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<RecordCategory | '전체'>('전체')

  const { data: records = [] } = useQuery({
    queryKey: ['records', petId],
    queryFn: async () => {
      const { data } = await supabase
        .from('records')
        .select('*')
        .eq('pet_id', petId)
        .order('event_on', { ascending: false })
      return (data ?? []) as PetRecord[]
    },
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['records', petId] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">{t('sectionTitle')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{t('sectionSubtitle')}</p>
        </div>
        <button onClick={() => { setAdding(a => !a); setEditingId(null) }} className="text-sm text-primary-600 font-semibold">
          {adding ? tc('close') : t('addRecord')}
        </button>
      </div>

      {adding && !editingId && (
        <RecordForm petId={petId} onDone={() => { setAdding(false); invalidate() }} onCancel={() => setAdding(false)} />
      )}

      {/* 영수증·이력서 사진으로 한 번에 등록 (기록과 같은 맥락에 배치) */}
      {onScan && !adding && !editingId && (
        <button
          onClick={onScan}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-primary-300 bg-primary-50 text-primary-700 text-sm font-medium"
        >
          {t('scanRecord')}
        </button>
      )}

      {/* 카테고리 필터 */}
      {records.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {(['전체', ...RECORD_CATEGORIES.filter(c => records.some(r => r.category === c))] as const).map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === c ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-200'
              }`}>
              {c === '전체' ? t('filterAll') : `${careCategoryIcon(c)} ${c}`}
            </button>
          ))}
        </div>
      )}

      {records.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3">{t('empty')}</p>
      ) : (
        <div className="space-y-2">
          {records.filter(r => filter === '전체' || r.category === filter).map(r => (
            editingId === r.id ? (
              <RecordForm key={r.id} petId={petId} record={r}
                onDone={() => { setEditingId(null); invalidate() }}
                onCancel={() => setEditingId(null)} />
            ) : (
              <RecordRow key={r.id} r={r}
                onEdit={() => { setEditingId(r.id); setAdding(false) }}
                onDeleted={invalidate} />
            )
          ))}
        </div>
      )}
    </div>
  )
}
