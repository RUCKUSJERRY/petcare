'use client'

import { createClient } from '@/lib/supabase/client'
import { calcPetAge, lifeStageColor, nextAnniversary, daysTogether, ddayBadge, todayKST } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import type { Breed, Pet } from '@/types'
import { ImagePicker } from '@/components/ui/ImagePicker'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { deleteImageByUrl } from '@/lib/upload'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { WeightSection } from '../_components/WeightSection'
import { PetMembers } from '../_components/PetMembers'
import { QuickLogBar } from '../_components/QuickLogBar'
import { RecordFeed } from '../_components/RecordFeed'
import { RecordDetailModal } from '../_components/RecordDetailModal'
import { RecordFormModal } from '../_components/RecordFormModal'
import { RecordsScanModal } from '../_components/RecordsScanModal'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'

export default function PetDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('petDetail')
  const tc = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  // 홈 빠른 기록 버튼에서 ?add=weight 로 진입하면 체중 폼을 펼친 채로 시작
  const addTarget = searchParams.get('add')
  const weightRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { selectedPetId, setSelectedPetId } = useSelectedPet()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [uid, setUid] = useState<string | null>(null)
  // 기록 패널: 항목 상세 모달 / 직접기록·스캔 모달
  const [detailId, setDetailId] = useState<string | null>(null)
  const [recModal, setRecModal] = useState<null | 'manual' | 'scan'>(null)
  const [form, setForm] = useState({
    name: '', breed_id: '', birth_year: '', birth_month: '', birth_day: '', adopted_on: '', gender: '', weight_kg: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null))
  }, [supabase])

  const { data: pet, refetch, isPending } = useQuery({
    queryKey: ['pet', params.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pets')
        .select('*, breed:breeds(*)')
        .eq('id', params.id)
        .single()
      // 삭제됨/오탐/RLS 거부 시 data 는 null 로 정착한다. null 을 그대로 반환하되,
      // 화면에서는 '로딩'(isPending)과 '없음'(정착된 null)을 구분해 처리한다.
      return (data ?? null) as (Pet & { breed: Breed }) | null
    },
  })

  const { data: allBreeds } = useQuery({
    queryKey: ['breeds-all'],
    queryFn: async () => {
      const { data } = await supabase.from('breeds').select('id,name_ko,species').order('name_ko')
      return (data ?? []) as Pick<Breed, 'id' | 'name_ko' | 'species'>[]
    },
  })

  // 이 상세 페이지에 들어오면 헤더/플로팅 빠른기록(FAB)의 '선택된 아이'를 지금 보고 있는
  // 아이로 맞춘다. (이 동기화가 없으면 다견 사용자가 A가 선택된 상태에서 B의 상세로 들어와
  // FAB로 기록할 때 엉뚱하게 A에게 기록되던 버그가 있었다.)
  useEffect(() => {
    if (pet && selectedPetId !== params.id) setSelectedPetId(params.id)
  }, [pet, params.id, selectedPetId, setSelectedPetId])

  useEffect(() => {
    if (pet) {
      setForm({
        name: pet.name,
        breed_id: pet.breed_id,
        birth_year: String(pet.birth_year),
        birth_month: String(pet.birth_month),
        birth_day: pet.birth_day ? String(pet.birth_day) : '',
        adopted_on: pet.adopted_on ?? '',
        gender: pet.gender,
        weight_kg: pet.weight_kg ? String(pet.weight_kg) : '',
      })
      setPhotoUrl(pet.photo_url)
    }
  }, [pet])

  // ?add=weight 진입 시 체중 섹션으로 부드럽게 스크롤
  useEffect(() => {
    if (!pet || addTarget !== 'weight') return
    const el = weightRef.current
    if (el) {
      const t = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
      return () => clearTimeout(t)
    }
  }, [pet, addTarget])

  // 기록(원탭·직접·스캔) 후 이 아이의 오늘/피드/예정 캐시를 갱신
  const afterRecord = () => {
    queryClient.invalidateQueries({ queryKey: ['today-timeline', params.id] })
    queryClient.invalidateQueries({ queryKey: ['today-log', params.id] })
    queryClient.invalidateQueries({ queryKey: ['record-feed', params.id] })
    queryClient.invalidateQueries({ queryKey: ['care-schedule'] })
  }

  const handleSave = async () => {
    // 신규 등록 폼과 동일하게 필수값을 검증한다.
    // (검증이 없으면 이름 공란 저장·출생연도 공란 → parseInt('')=NaN 으로 저장 실패)
    if (!form.name.trim()) { setSaveError(t('errNameRequired')); return }
    const by = parseInt(form.birth_year, 10)
    if (!Number.isFinite(by) || by < 1990 || by > new Date().getFullYear()) {
      setSaveError(t('errBirthYearRequired')); return
    }
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase.from('pets').update({
      name: form.name,
      breed_id: form.breed_id,
      birth_year: parseInt(form.birth_year),
      birth_month: parseInt(form.birth_month),
      birth_day: form.birth_day ? parseInt(form.birth_day) : null,
      adopted_on: form.adopted_on || null,
      gender: form.gender,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      photo_url: photoUrl,
    }).eq('id', params.id)
    setSaving(false)
    if (error) {
      setSaveError(t('errSaveFailed'))
      // 저장이 실패하면 이번에 새로 올린 사진은 어디서도 참조되지 않는 고아가 된다.
      // 정리하고 폼을 원본 사진으로 되돌린다.
      if (photoUrl && photoUrl !== pet?.photo_url) {
        deleteImageByUrl(photoUrl)
        setPhotoUrl(pet?.photo_url ?? null)
      }
      return
    }
    // 사진을 바꾼/지운 경우 기존 커밋 파일 정리(고아 방지)
    if (pet?.photo_url && pet.photo_url !== photoUrl) {
      deleteImageByUrl(pet.photo_url)
    }
    await refetch()
    // 공용 펫 목록 캐시도 갱신 (헤더/다른 화면 반영)
    queryClient.invalidateQueries({ queryKey: ['my-pets'] })
    setEditing(false)
  }

  const handleDelete = async () => {
    setDeleteError(null)
    const { error } = await supabase.from('pets').delete().eq('id', params.id)
    if (error) {
      setDeleteError(t('errDeleteFailed'))
      setShowDeleteModal(false)
      return
    }
    // 사진 파일 정리
    if (pet?.photo_url) deleteImageByUrl(pet.photo_url)
    // 삭제한 아이가 선택돼 있었다면 해제하고, 펫 목록 캐시 무효화
    if (selectedPetId === params.id) setSelectedPetId(null)
    queryClient.invalidateQueries({
      predicate: q => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('my-pets'),
    })
    router.push('/dashboard')
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // 로딩 중에는 스켈레톤을, 조회가 끝났는데도 없으면(삭제/권한없음) 안내를 보여준다.
  // (이전엔 두 경우 모두 '불러오는 중'만 떠서 없는 아이 진입 시 영원히 로딩처럼 보였다.)
  if (isPending) return <div className="px-4 py-6"><CardSkeletonList count={3} /></div>
  if (!pet) return (
    <div className="px-4 py-6">
      <EmptyState
        variant="error"
        icon="🐾"
        title={t('notFoundTitle')}
        hint={t('notFoundHint')}
        action={
          <Link href="/pets" className="btn-primary text-sm py-1.5 px-4 inline-block">
            {t('toPetList')}
          </Link>
        }
      />
    </div>
  )

  const age = calcPetAge(pet.birth_year, pet.birth_month, pet.species)

  return (
    <div className="px-4 py-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="text-gray-400" aria-label={t('back')}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{pet.name}</h1>
        <button
          onClick={() => { setEditing(e => !e); setSaveError(null) }}
          className={editing ? 'text-sm text-gray-400' : 'text-sm text-primary-600 font-semibold'}
        >
          {editing ? tc('cancel') : t('edit')}
        </button>
      </div>

      {/* 프로필 카드 */}
      {!editing ? (
        <div className="card flex items-center gap-4">
          <PetAvatar photoUrl={pet.photo_url} species={pet.species} name={pet.name}
            className="w-16 h-16 bg-primary-100" emojiClassName="text-3xl" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">{pet.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lifeStageColor(age.lifeStage)}`}>
                {age.lifeStage}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{pet.breed?.name_ko} · {age.displayText} · {pet.gender}</p>
            {pet.weight_kg && <p className="text-sm text-gray-400 mt-0.5">{pet.weight_kg}kg</p>}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {pet.birth_day && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 font-medium">
                  {t('birthday')} {t('birthdayValue', { month: pet.birth_month, day: pet.birth_day })}
                  {(() => {
                    const next = nextAnniversary(pet.birth_month, pet.birth_day)
                    return next ? ` · ${ddayBadge(next).text}` : ''
                  })()}
                </span>
              )}
              {(() => {
                const days = daysTogether(pet.adopted_on)
                return days != null ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium">
                    {t('together', { days })}
                  </span>
                ) : null
              })()}
            </div>
          </div>
        </div>
      ) : (
        <div className="card space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t('photo')}</label>
            <ImagePicker
              bucket="pet-photos"
              value={photoUrl}
              onUploaded={url => { setPhotoUrl(url); setPhotoError(null) }}
              onError={setPhotoError}
              shape="circle"
            />
            {photoError && <p className="text-sm text-red-500 mt-1.5">{photoError}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{t('name')}</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{pet.species === 'cat' ? t('breedCat') : t('breedDog')}</label>
            <select className="input" value={form.breed_id} onChange={e => set('breed_id', e.target.value)}>
              {(allBreeds ?? []).filter(b => b.species === pet.species).map(b => (
                <option key={b.id} value={b.id}>{b.name_ko}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">{t('birthYear')}</label>
              <input className="input" type="number" value={form.birth_year}
                onChange={e => set('birth_year', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">{t('birthMonth')}</label>
              <select className="input" value={form.birth_month} onChange={e => set('birth_month', e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i+1} value={i+1}>{t('monthN', { n: i+1 })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">{t('birthDay')}</label>
              <select className="input" value={form.birth_day} onChange={e => set('birth_day', e.target.value)}>
                <option value="">{t('daySelect')}</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i+1} value={i+1}>{t('dayN', { n: i+1 })}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{t('adoptedOn')}</label>
            <input className="input" type="date" max={todayKST()}
              value={form.adopted_on} onChange={e => set('adopted_on', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{t('gender')}</label>
            <div className="grid grid-cols-2 gap-2">
              {['수컷', '암컷'].map(g => (
                <button key={g} type="button" onClick={() => set('gender', g)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    form.gender === g ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
                  }`}>
                  {g === '수컷' ? t('genderMale') : t('genderFemale')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">{t('weight')}</label>
            <input className="input" type="number" step="0.1" value={form.weight_kg}
              onChange={e => set('weight_kg', e.target.value)} />
          </div>
          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3">
            {saving ? tc('saving') : t('saveProfile')}
          </button>
        </div>
      )}

      {/* 내 아이 기록 (조회 모드에서만) */}
      {!editing && (
        <>
          {/* 원탭 생활기록 + 시간순 피드 + 직접기록/스캔 — 홈 요약카드와 동일한 기록 진입을
              이 아이의 상세 페이지에서도 그대로 제공(상세가 요약카드의 상위집합이 되도록). */}
          <div className="card space-y-2">
            <p className="text-sm font-semibold text-gray-500">{t('recordSection')}</p>
            <QuickLogBar
              petId={params.id}
              onOpenDetail={setDetailId}
              onLogged={afterRecord}
            />
            <RecordFeed petId={params.id} scroll onSelect={setDetailId} />
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button type="button" onClick={() => setRecModal('manual')}
                className="flex items-center justify-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 text-xs font-medium hover:bg-gray-100 transition-colors">
                <span aria-hidden>📝</span> {t('recordManual')}
              </button>
              <button type="button" onClick={() => setRecModal('scan')}
                className="flex items-center justify-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg py-2 text-xs font-medium hover:bg-gray-100 transition-colors">
                <span aria-hidden>📷</span> {t('recordScan')}
              </button>
            </div>
          </div>

          <div ref={weightRef}>
            <WeightSection petId={params.id} defaultOpen={addTarget === 'weight'} />
          </div>
          <PetMembers petId={params.id} petName={pet.name} />
        </>
      )}

      {/* 삭제 에러 */}
      {deleteError && (
        <p className="text-sm text-red-500 text-center">{deleteError}</p>
      )}

      {/* 삭제 버튼 — 소유자(등록자)만. 구성원은 '공동 관리에서 나가기' 사용 */}
      {!editing && pet.user_id === uid && (
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full py-3 rounded-lg border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-1"
        >
          <span aria-hidden>🗑</span> {t('deletePet')}
        </button>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <ConfirmModal
          title={t('deleteModalTitle', { name: pet.name })}
          description={t('deleteModalDesc')}
          confirmLabel={tc('delete')}
          destructive
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {/* 기록 상세/직접기록/스캔 모달 */}
      {detailId && (
        <RecordDetailModal recordId={detailId} onClose={() => setDetailId(null)} onChanged={afterRecord} />
      )}
      {recModal === 'manual' && (
        <RecordFormModal
          petId={params.id}
          title={t('recordManual')}
          onClose={() => setRecModal(null)}
          onDone={() => { setRecModal(null); afterRecord() }}
        />
      )}
      {recModal === 'scan' && (
        <RecordsScanModal petId={params.id} onClose={() => { setRecModal(null); afterRecord() }} />
      )}
    </div>
  )
}
