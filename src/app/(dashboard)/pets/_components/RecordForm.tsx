'use client'

import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMyPets } from '@/hooks/useMyPets'
import { careCategoryIcon, todayKST, isoToLocalTime, nowLocalTime, localDateTimeToIso } from '@/lib/utils'
import { MultiImagePicker } from '@/components/ui/MultiImagePicker'
import { PlacePicker, type PlaceValue } from '@/components/ui/PlacePicker'
import { FilterScroller } from '@/components/ui/FilterScroller'
import { RecordDateTime } from './RecordDateTime'
import { deleteImageByUrl } from '@/lib/upload'
import { CATEGORY_GROUPS, CATEGORY_CONFIG, DETAIL_TABLE, DAILY_LOG_SET, defaultRecordTitle } from '@/lib/records'
import {
  type RecurRule, type Weekday, type WeekOrdinal,
  WEEKDAY_LABELS, WEEK_ORDINAL_LABELS,
  parseRule, serializeRule, parseYMD, ymd, nextOccurrence, describeRule,
} from '@/lib/recurrence'
import type { PetRecord, RecordCategory } from '@/types'

const today = () => todayKST()
const DETAIL_TABLES = ['record_medical', 'record_grooming', 'record_meal'] as const

/**
 * 통합 기록 입력/수정 폼 (구글 캘린더형).
 * 카테고리에 따라 상세 입력 필드가 바뀌고, 반복주기는 선택사항이다.
 * 아이 상세(petId 고정)와 일정 화면(allowPetSelect) 모두에서 재사용.
 */
/** 외부(모달 헤더)에서 저장을 트리거할 수 있도록 노출하는 핸들 */
export type RecordFormHandle = { submit: () => void }

export const RecordForm = forwardRef<RecordFormHandle, {
  petId?: string | null
  allowPetSelect?: boolean
  record?: PetRecord
  defaultCategory?: RecordCategory
  /** 신규 기록의 기본 날짜(YYYY-MM-DD). 캘린더에서 특정 날짜를 눌러 추가할 때 사용 */
  defaultDate?: string
  /** 신규 기록 프리필(반복 케어의 다음 회차를 '완료로 기록'할 때 라인 정보를 미리 채운다) */
  template?: { category?: RecordCategory; title?: string; recur_rule?: string | null }
  /** 모달 등 외부 헤더가 따로 있을 때: 내부 헤더·카드 틀·하단 저장버튼을 숨긴다 */
  embedded?: boolean
  /** 저장 진행 상태를 외부(헤더 버튼)에 알린다 */
  onSavingChange?: (saving: boolean) => void
  /** 상세 로드 완료(=저장 가능) 여부를 외부(헤더 저장 버튼)에 알린다 */
  onReadyChange?: (ready: boolean) => void
  onDone: () => void
  onCancel: () => void
}>(function RecordForm({
  petId: fixedPetId,
  allowPetSelect = false,
  record,
  defaultCategory = '진료',
  defaultDate,
  template,
  embedded = false,
  onSavingChange,
  onReadyChange,
  onDone,
  onCancel,
}, ref) {
  const t = useTranslations('records')
  const tc = useTranslations('common')
  const supabase = createClient()
  const qc = useQueryClient()
  const { data: pets = [] } = useMyPets()
  const editing = !!record

  const [petId, setPetId] = useState<string>(record?.pet_id || fixedPetId || '')
  const [category, setCategory] = useState<RecordCategory>(record?.category || template?.category || defaultCategory)
  const [title, setTitle] = useState(record?.title || template?.title || '')
  const [eventOn, setEventOn] = useState(record?.event_on || defaultDate || today())
  // 생활기록의 시각(HH:MM). 편집 시 기존 event_at에서, 신규는 현재 시각.
  const [eventTime, setEventTime] = useState<string>(isoToLocalTime(record?.event_at) ?? nowLocalTime())
  const [place, setPlace] = useState<PlaceValue>({
    name: record?.place_name || '', lat: record?.place_lat ?? null, lng: record?.place_lng ?? null,
  })
  const [cost, setCost] = useState(record?.cost != null ? String(record.cost) : '')
  const [memo, setMemo] = useState(record?.memo || '')
  const initialPhotos = record?.photo_urls?.length ? record.photo_urls : (record?.photo_url ? [record.photo_url] : [])
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialPhotos)
  const [existingPhotos] = useState<string[]>(initialPhotos)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, string>>({})
  // 편집 시 상세 테이블 로드 완료 여부. 로드 전 저장하면 기존 상세가 빈 값으로 덮어써지므로 막는다.
  // 상세 테이블이 있는 기존 기록만 비동기 로드가 필요하다. 그 외(신규·상세없는 카테고리)는
  // 처음부터 저장 가능 상태로 둬서, 저장 버튼이 순간적으로 비활성화되는 깜빡임을 막는다.
  const [detailLoaded, setDetailLoaded] = useState(() => !record || !DETAIL_TABLE[record.category])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 반복 규칙 상태 (신규 회차 프리필 시 template 의 규칙을 이어받아 같은 주기로 계속 굴러가게 한다)
  const initRule = parseRule(record?.recur_rule ?? template?.recur_rule ?? null)
  const eventWeekday = parseYMD(record?.event_on || today()).getDay() as Weekday
  const [recurOn, setRecurOn] = useState<boolean>(!!initRule)
  const [freq, setFreq] = useState<RecurRule['freq']>(initRule?.freq ?? 'month')
  const [interval, setIntervalN] = useState<string>(initRule ? String(initRule.interval) : '1')
  const [byweekday, setByweekday] = useState<Weekday[]>(
    initRule?.freq === 'week' ? initRule.byweekday : [eventWeekday]
  )
  const [monthMode, setMonthMode] = useState<'dom' | 'dow'>(
    initRule?.freq === 'month' ? initRule.mode : 'dom'
  )
  const [monthWeek, setMonthWeek] = useState<WeekOrdinal>(
    initRule?.freq === 'month' && initRule.mode === 'dow' ? initRule.week : (Math.floor((parseYMD(record?.event_on || today()).getDate() - 1) / 7) + 1) as WeekOrdinal
  )
  // 반복이 아닐 때만 쓰는 수동 다음 예정일
  const [manualDue, setManualDue] = useState<string>(!initRule ? (record?.next_due_on || '') : '')

  const effectivePetId = petId || fixedPetId || pets[0]?.id || ''
  const config = CATEGORY_CONFIG[category]

  // 현재 입력으로부터 반복 규칙 객체 구성
  const buildRule = (): RecurRule | null => {
    if (!recurOn) return null
    const iv = Math.max(1, parseInt(interval || '1', 10) || 1)
    const wd = parseYMD(eventOn).getDay() as Weekday
    switch (freq) {
      case 'day': return { freq: 'day', interval: iv }
      case 'week': return { freq: 'week', interval: iv, byweekday: byweekday.length ? byweekday : [wd] }
      case 'month': return monthMode === 'dow'
        ? { freq: 'month', interval: iv, mode: 'dow', week: monthWeek, weekday: wd }
        : { freq: 'month', interval: iv, mode: 'dom' }
      case 'year': return { freq: 'year', interval: iv }
    }
  }
  const rule = buildRule()
  // 반복이면 시작일 다음 발생일을, 아니면 수동 입력값을 다음 예정일로 사용
  const computedNext = rule
    ? (() => { const n = nextOccurrence(rule, parseYMD(eventOn), parseYMD(eventOn)); return n ? ymd(n) : null })()
    : (manualDue || null)

  // 편집 시 상세 테이블 값 로드
  useEffect(() => {
    // 신규 작성이거나 상세 테이블이 없는 카테고리는 로드할 것이 없으므로 바로 완료 처리
    if (!record) { setDetailLoaded(true); return }
    const table = DETAIL_TABLE[record.category]
    if (!table) { setDetailLoaded(true); return }
    let cancelled = false
    supabase.from(table).select('*').eq('record_id', record.id).maybeSingle().then(({ data }) => {
      if (cancelled) return
      if (data) {
        const d: Record<string, string> = {}
        Object.entries(data).forEach(([k, v]) => { if (k !== 'record_id') d[k] = (v as string) ?? '' })
        setDetail(d)
      }
      setDetailLoaded(true)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleWeekday = (w: Weekday) =>
    setByweekday(ws => ws.includes(w) ? ws.filter(x => x !== w) : [...ws, w])

  // 카테고리 전환 시 상세를 초기화하고, 제목이 '보기 선택형'(예: 배변→소변/대변/둘다)인 경우
  // 기본 보기를 선택해 둔다. 반대로 선택형에서 벗어나면 이전에 채워진 보기값을 비운다.
  const selectCategory = (c: RecordCategory) => {
    const opts = CATEGORY_CONFIG[c].titleOptions
    if (opts) { if (!opts.includes(title)) setTitle(opts[0]) }
    else if (CATEGORY_CONFIG[category].titleOptions) setTitle('')
    setCategory(c)
    setDetail({})
  }

  const isDailyLog = DAILY_LOG_SET.has(category)

  // 저장 상태 갱신을 외부(헤더 저장 버튼)에도 반영
  const setSavingState = (v: boolean) => { setSaving(v); onSavingChange?.(v) }

  const submit = async () => {
    if (saving) return // 중복 저장 방지(헤더/하단 버튼 동시 트리거 대비)
    // 상세 로드 전 저장하면 진료/미용/식사 상세가 빈 값으로 덮어써진다 → 로드 완료까지 대기
    if (!detailLoaded) return
    if (!effectivePetId) { setError(t('errNoPet')); return }
    if (!recurOn && manualDue && manualDue < eventOn) { setError(t('errDueAfter')); return }
    setSavingState(true); setError(null)
    // 제목은 선택 — 비우면 카테고리명을 제목으로(생활기록을 빠르게 남기기 위함)
    const finalTitle = title.trim() || defaultRecordTitle(category)
    // 생활기록은 시간순 타임라인용 시각(event_at)을 날짜+시:분으로 저장(편집 가능).
    // 일정성 기록은 시각 개념이 없어 기존 값을 유지한다.
    const eventAt: string | null = isDailyLog
      ? localDateTimeToIso(eventOn, eventTime)
      : (record?.event_at ?? null)
    const common = {
      pet_id: effectivePetId,
      category,
      title: finalTitle,
      event_on: eventOn,
      event_at: eventAt,
      place_name: place.name.trim() || null,
      place_lat: place.lat,
      place_lng: place.lng,
      cost: cost ? parseInt(cost, 10) : null,
      memo: memo.trim() || null,
      photo_url: photoUrls[0] ?? null,
      photo_urls: photoUrls.length ? photoUrls : null,
      // 생활기록(식사·배변 등)은 반복 UI 자체가 숨겨져 있다. 하지만 recurOn/manualDue 상태는
      // 카테고리 전환 시 초기화되지 않으므로(예: 접종에 반복 설정 후 배변으로 변경), 여기서
      // 카테고리 기준으로 한 번 더 차단한다. 방치하면 배변 기록에 recur_rule/next_due_on 이 붙어
      // 일정·캘린더에 유령 예정으로 뜨고, care-reminders 가 헛푸시를 보낸다.
      recur_rule: isDailyLog ? null : (rule ? serializeRule(rule) : null),
      next_due_on: isDailyLog ? null : computedNext,
    }

    let recordId = record?.id
    if (editing && recordId) {
      const { error: e } = await supabase.from('records').update(common).eq('id', recordId)
      if (e) { setSavingState(false); setError(t('errSaveFailed')); return }
    } else {
      const { data, error: e } = await supabase.from('records').insert(common).select('id').single()
      if (e || !data) { setSavingState(false); setError(t('errSaveFailed')); return }
      recordId = data.id as string
    }

    // 상세 테이블 동기화 (편집 시 카테고리 변경 대비 3종 정리 후 재기록)
    const table = DETAIL_TABLE[category]
    if (editing && recordId) {
      await Promise.all(DETAIL_TABLES.map(tb => supabase.from(tb).delete().eq('record_id', recordId!)))
    }
    if (table && recordId) {
      const row: Record<string, unknown> = { record_id: recordId }
      for (const f of config.fields) row[f.key] = detail[f.key]?.trim() || null
      await supabase.from(table).insert(row)
    }

    // 편집 중 제거된 기존 사진 정리(고아 방지)
    if (editing) existingPhotos.filter(u => !photoUrls.includes(u)).forEach(deleteImageByUrl)

    setSavingState(false)
    // 홈 타임라인·피드·오늘 기록까지 즉시 갱신 (QuickLogBar 와 동일한 무효화 세트)
    qc.invalidateQueries({ queryKey: ['records', effectivePetId] })
    qc.invalidateQueries({ queryKey: ['care-schedule'] })
    qc.invalidateQueries({ queryKey: ['today-log', effectivePetId] })
    qc.invalidateQueries({ queryKey: ['today-timeline', effectivePetId] })
    qc.invalidateQueries({ queryKey: ['today-timeline', null] })
    qc.invalidateQueries({ queryKey: ['record-feed', effectivePetId] })
    qc.invalidateQueries({ queryKey: ['record-feed', null] })
    // 홈 생활 패턴 카드(식사·물·배변 추이)도 새 기록 즉시 반영
    qc.invalidateQueries({ queryKey: ['life-pattern', effectivePetId] })
    // 비용이 포함된 기록이면 비용 통계(costs 화면)도 갱신 대상 — 조건 없이 무효화해 정합성 유지.
    qc.invalidateQueries({ queryKey: ['cost-records'] })
    onDone()
  }

  useImperativeHandle(ref, () => ({ submit }))

  // 상세 로드 완료(=저장 가능) 여부를 외부 헤더 저장 버튼에 반영 → 로드 전 저장이 조용히
  // 무시되지 않게 버튼을 비활성화할 수 있다.
  useEffect(() => { onReadyChange?.(detailLoaded) }, [detailLoaded, onReadyChange])

  const cancel = () => {
    // 새로 올린(미저장) 사진 정리
    photoUrls.filter(u => !existingPhotos.includes(u)).forEach(deleteImageByUrl)
    onCancel()
  }

  return (
    <div className={embedded ? 'space-y-2.5' : 'card space-y-2.5'}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{editing ? t('editTitle') : t('addTitle')}</h2>
          <button onClick={cancel} className="text-sm text-gray-400">{tc('cancel')}</button>
        </div>
      )}

      {/* 아이 선택 (일정 화면) */}
      {allowPetSelect && pets.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {pets.map(p => (
            <button key={p.id} type="button" onClick={() => setPetId(p.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                effectivePetId === p.id ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
              }`}>
              {p.species === 'cat' ? '🐱' : '🐶'} {p.name}
            </button>
          ))}
        </div>
      )}

      {/* 카테고리 — 생활관리 / 건강관리 그룹별로, 좌우 드래그(가로 스크롤)로 선택 */}
      <div className="space-y-1.5">
        {CATEGORY_GROUPS.map(g => (
          <div key={g.key}>
            <p className="text-[11px] font-semibold text-gray-400 mb-1">{g.label}</p>
            <FilterScroller>
              {g.categories.map(c => (
                <button key={c} type="button" onClick={() => selectCategory(c)}
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    category === c ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
                  }`}>
                  {careCategoryIcon(c)} {c}
                </button>
              ))}
            </FilterScroller>
          </div>
        ))}
      </div>

      {/* 제목 — 배변처럼 정해진 보기가 있으면 칩 선택, 아니면 자유 입력 */}
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">{config.titleLabel}</label>
        {config.titleOptions ? (
          <div className="flex gap-1.5">
            {config.titleOptions.map(opt => (
              <button key={opt} type="button" onClick={() => setTitle(opt)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  title === opt ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
                }`}>
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <input className="input" placeholder={config.titlePlaceholder}
            value={title} onChange={e => setTitle(e.target.value)} />
        )}
      </div>

      {/* 날짜·시간 (생활기록은 시:분 + 빠른 ±버튼) */}
      <RecordDateTime
        date={eventOn} time={eventTime} withTime={isDailyLog}
        onChange={(d, tm) => { setEventOn(d); if (tm) setEventTime(tm) }}
      />

      {/* 비용 */}
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">{t('cost')}</label>
        <input className="input" type="number" inputMode="numeric" min={0} placeholder={t('costPlaceholder')}
          value={cost} onChange={e => setCost(e.target.value)} />
      </div>

      {/* 장소 (카카오 검색) */}
      <PlacePicker value={place} onChange={setPlace} placeholder={t('placePlaceholder')} />

      {/* 카테고리별 상세 필드 */}
      {config.fields.map(f => (
        <div key={f.key}>
          <label className="text-xs text-gray-500 block mb-0.5">{f.label}</label>
          {f.type === 'select' ? (
            <div className="flex gap-1.5">
              {(f.options ?? []).map(opt => (
                <button key={opt} type="button" onClick={() => setDetail(d => ({ ...d, [f.key]: opt }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    detail[f.key] === opt ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
          ) : f.type === 'textarea' ? (
            <textarea className="input min-h-[60px]" placeholder={f.placeholder}
              value={detail[f.key] ?? ''} onChange={e => setDetail(d => ({ ...d, [f.key]: e.target.value }))} />
          ) : (
            <input className="input" type={f.type === 'number' ? 'number' : 'text'} placeholder={f.placeholder}
              value={detail[f.key] ?? ''} onChange={e => setDetail(d => ({ ...d, [f.key]: e.target.value }))} />
          )}
        </div>
      ))}

      {/* 반복 설정 (구글 캘린더형) — 생활기록(식사·배변 등)에는 숨김 */}
      {!isDailyLog && (
      <div className="rounded-lg bg-gray-50 p-2.5 space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={recurOn} onChange={e => setRecurOn(e.target.checked)}
            className="w-4 h-4 accent-primary-500" />
          {t('recurToggle')}
        </label>

        {recurOn ? (
          <div className="space-y-2">
            {/* 빈도 + 간격 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 shrink-0">{t('recurEveryN')}</span>
              <input className="input w-16 text-center" type="number" inputMode="numeric" min={1}
                value={interval} onChange={e => setIntervalN(e.target.value)} />
              <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
                {(['day', 'week', 'month', 'year'] as const).map(f => (
                  <button key={f} type="button" onClick={() => setFreq(f)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${freq === f ? 'bg-primary-500 text-white' : 'text-gray-500'}`}>
                    {t(`freq_${f}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* 주: 요일 선택 */}
            {freq === 'week' && (
              <div className="flex gap-1">
                {WEEKDAY_LABELS.map((lab, w) => (
                  <button key={w} type="button" onClick={() => toggleWeekday(w as Weekday)}
                    className={`w-8 h-8 rounded-full text-xs font-medium ${byweekday.includes(w as Weekday) ? 'bg-primary-500 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                    {lab}
                  </button>
                ))}
              </div>
            )}

            {/* 월: N일 vs N째주 요일 */}
            {freq === 'month' && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  {(['dom', 'dow'] as const).map(m => (
                    <button key={m} type="button" onClick={() => setMonthMode(m)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${monthMode === m ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {m === 'dom' ? t('monthDom', { day: parseYMD(eventOn).getDate() }) : t('monthDow')}
                    </button>
                  ))}
                </div>
                {monthMode === 'dow' && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {([1, 2, 3, 4, 5, -1] as WeekOrdinal[]).map(wk => (
                      <button key={wk} type="button" onClick={() => setMonthWeek(wk)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium border ${monthWeek === wk ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                        {WEEK_ORDINAL_LABELS[String(wk)]}
                      </button>
                    ))}
                    <span className="text-xs text-gray-500">{WEEKDAY_LABELS[parseYMD(eventOn).getDay()]}요일</span>
                  </div>
                )}
              </div>
            )}

            {/* 규칙 요약 + 다음 예정 */}
            <p className="text-xs text-primary-600">
              🔁 {describeRule(rule, eventOn)}
              {computedNext && <span className="text-gray-400"> · {t('nextScheduled', { date: computedNext })}</span>}
            </p>
          </div>
        ) : (
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">{t('nextDue')}</label>
            <input className="input" type="date" value={manualDue} onChange={e => setManualDue(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">{t('recurHint')}</p>
          </div>
        )}
      </div>
      )}

      {/* 메모 */}
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">{t('memo')}</label>
        <textarea className="input min-h-[48px]" placeholder={t('memoPlaceholder')}
          value={memo} onChange={e => setMemo(e.target.value)} />
      </div>

      {/* 사진 */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('photo')}</label>
        <MultiImagePicker bucket="pet-photos" value={photoUrls}
          onChange={urls => { setPhotoUrls(urls); setPhotoError(null) }} onError={setPhotoError} />
        {photoError && <p className="text-sm text-red-500 mt-1.5">{photoError}</p>}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {/* 임베디드(모달)일 땐 저장 버튼을 모달 헤더에 둔다 → 하단 버튼 숨김 */}
      {!embedded && (
        <button onClick={submit} disabled={saving || !detailLoaded} className="btn-primary w-full py-2 text-sm disabled:opacity-60">
          {saving ? tc('saving') : editing ? tc('edit') : tc('save')}
        </button>
      )}
    </div>
  )
})
