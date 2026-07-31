'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSelectedPet } from '@/contexts/SelectedPetContext'
import { useMyPets } from '@/hooks/useMyPets'
import { calcPetAge } from '@/lib/utils'
import { foodGuidesForSpecies, type FoodGuideTopic } from '@/lib/foodGuideData'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionTabs } from '@/components/ui/SectionTabs'
import { CardSkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { StickyAffiliateBanner } from '@/components/ui/StickyAffiliateBanner'
import { FeedCalculator } from '../care/_components/FeedCalculator'
import { BcsAssessment } from './_components/BcsAssessment'
import type { BreedFoodRule, FoodItem, FoodSafety, PetAge, Species } from '@/types'

/** 생애 단계 → 급여 계산기 기본 계수 */
function toFeedFactor(lifeStage: PetAge['lifeStage'] | undefined): 'neutered' | 'growth' | 'senior' {
  if (lifeStage === '퍼피' || lifeStage === '키튼') return 'growth'
  if (lifeStage === '시니어') return 'senior'
  return 'neutered'
}

/** 사료·간식 가이드 접이식 카드 */
function FoodGuideCard({ guide }: { guide: FoodGuideTopic }) {
  const t = useTranslations('foods')
  const [open, setOpen] = useState(false)
  return (
    <div className="card space-y-2 border-l-4 border-primary-400" style={{ borderRadius: '0 12px 12px 0' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2.5 text-left">
        <span className="text-2xl shrink-0" aria-hidden>{guide.icon}</span>
        <span className="flex-1 font-semibold text-gray-900">{guide.title}</span>
        <span className="text-gray-400 text-sm shrink-0">{open ? t('collapse') : t('expand')}</span>
      </button>
      {open && (
        <ul className="space-y-1.5 pt-1">
          {guide.points.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-600 leading-relaxed">
              <span className="text-primary-400 shrink-0" aria-hidden>•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const FILTERS = ['전체', '안전', '주의', '위험'] as const
type Filter = typeof FILTERS[number]

const CATEGORIES = ['전체', '육류', '채소', '과일', '유제품', '기타'] as const
type CategoryFilter = typeof CATEGORIES[number]
const categoryIcon: Record<string, string> = {
  육류: '🥩', 채소: '🥦', 과일: '🍎', 유제품: '🥛', 기타: '🍽️',
}

const filterMap: Record<Filter, string | null> = {
  '전체': null, '안전': 'safe', '주의': 'caution', '위험': 'dangerous',
}

const cardStyle: Record<string, string> = {
  safe:      'bg-green-50 border border-green-200',
  caution:   'bg-amber-50 border border-amber-200',
  dangerous: 'bg-red-50 border border-red-200',
}

const badgeStyle: Record<string, string> = {
  safe:      'bg-green-100 text-green-800',
  caution:   'bg-amber-100 text-amber-800',
  dangerous: 'bg-red-100 text-red-800',
}

const safetyLabel: Record<string, string> = {
  safe: '안전', caution: '주의', dangerous: '위험',
}

const cautionBg: Record<string, string> = {
  safe:      'bg-green-100 text-green-700',
  caution:   'bg-amber-100 text-amber-700',
  dangerous: 'bg-red-100 text-red-700',
}

function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type FoodRow = FoodItem & { food_safety: FoodSafety[] }

export default function FoodsPage() {
  const t = useTranslations('foods')
  const { selectedPetId } = useSelectedPet()

  // 화면 안에서 '음식 안전(검색·안전도)' 과 '급여 가이드(계산기·사료 정보)' 를 세그먼트로 나눠,
  // 급여 가이드가 긴 음식 목록 아래로 밀려 스크롤해야만 보이던 문제를 없앤다. 한 탭이면 바로 열린다.
  const [view, setView] = useState<'safety' | 'guide'>('safety')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('전체')
  const [category, setCategory] = useState<CategoryFilter>('전체')
  const [species, setSpecies] = useState<Species>('dog')
  const [breedFilter, setBreedFilter] = useState<string>('all')
  const initialized = useRef(false)
  const supabase = createClient()

  const { data: foods, isLoading, isError } = useQuery({
    queryKey: ['foods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_items')
        .select('*, food_safety(*)')
        .order('name_ko')
      // 에러를 던져 isError 로 표면화 — 음식 안전 조회는 실패가 '결과 없음'으로 오인되면
      // 걱정하는 보호자를 오도할 수 있어(고위험) 실패를 명확히 구분한다.
      if (error) throw error
      return (data ?? []) as FoodRow[]
    },
  })

  // 내 반려동물 목록 (species + breed 정보 포함)
  const { data: myPets } = useMyPets()

  // 선택된 펫이 바뀌면 species/breed 자동 세팅
  useEffect(() => {
    if (!myPets) return
    if (selectedPetId) {
      const pet = myPets.find(p => p.id === selectedPetId)
      if (pet) {
        setSpecies(pet.species)
        setBreedFilter(pet.breed_id ?? 'all')
        return
      }
    }
    // 선택된 펫 없음 → 최초 1회만 기본값 설정
    if (!initialized.current) {
      initialized.current = true
      const first = myPets[0]
      if (first) {
        setSpecies(first.species)
        setBreedFilter(first.breed_id ?? 'all')
      }
    }
  }, [selectedPetId, myPets])

  // 견종별 음식 규칙
  const { data: breedRules } = useQuery({
    queryKey: ['breed-food-rules', breedFilter],
    enabled: breedFilter !== 'all',
    queryFn: async () => {
      const { data } = await supabase
        .from('breed_food_rules')
        .select('*')
        .eq('breed_id', breedFilter)
      return (data ?? []) as BreedFoodRule[]
    },
  })

  const ruleMap = new Map<string, BreedFoodRule>(
    (breedRules ?? []).map(r => [r.food_id, r])
  )

  // 선택된 종의 안전도만 추출
  const rows = (foods ?? [])
    .map(f => ({ food: f, safety: f.food_safety.find(s => s.species === species) ?? null }))
    .filter(r => r.safety !== null) as { food: FoodRow; safety: FoodSafety }[]

  // 검색어 정규화: 앞뒤 공백 제거 + 소문자화. 안전도 조회는 오탐이 곧 오도(誤導)라,
  // 뒤 공백·대소문자 차이만으로 '결과 없음'이 떠 걱정하는 보호자를 오도하지 않게 한다.
  const q = search.trim().toLowerCase()
  const filtered = rows.filter(({ food, safety }) => {
    const effectiveSafety = ruleMap.get(food.id)?.override_safety || safety.safety_level
    const matchSearch = q === '' || food.name_ko.toLowerCase().includes(q)
    const matchFilter = filterMap[filter] === null || effectiveSafety === filterMap[filter]
    const matchCategory = category === '전체' || food.category === category
    return matchSearch && matchFilter && matchCategory
  })

  const filterBtnStyle = (f: Filter) => {
    if (filter !== f) return 'bg-white text-gray-500 border border-gray-200'
    return { '전체': 'bg-gray-700 text-white', '안전': 'bg-green-500 text-white', '주의': 'bg-amber-400 text-white', '위험': 'bg-red-500 text-white' }[f]
  }

  // 현재 선택된 펫 이름 (헤더에 표시)
  const activePet = selectedPetId ? myPets?.find(p => p.id === selectedPetId) : null
  const breedName = (activePet?.breed as unknown as { name_ko: string } | undefined)?.name_ko

  // 종 탭 노출 조건: 헤더에서 특정 아이를 고르면 그 아이의 종으로 고정되므로 숨긴다.
  // 아이를 안 골랐을 때(전체 보기)는 아이가 여러 마리(예: 강아지+고양이)여도 종을 직접
  // 바꿀 수 있어야 한다 — 예전엔 2마리 이상이면 탭이 사라져 첫 아이 종에 갇혔다.
  const showSpeciesTabs = !selectedPetId || !myPets || myPets.length <= 1

  // 급여량 계산기 기본값 (선택된 펫 → 없으면 첫 펫 기준)
  const calcPet = activePet ?? myPets?.[0] ?? null
  const calcAge = calcPet ? calcPetAge(calcPet.birth_year, calcPet.birth_month, calcPet.species) : null

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t('title')} />
        {activePet && (
          <span className="text-sm text-primary-600 font-medium shrink-0">
            {activePet.species === 'cat' ? '🐱' : '🐶'} {t('petBasis', { name: activePet.name })}
          </span>
        )}
      </div>

      <SectionTabs section="info" />

      {/* 화면 내 세그먼트: 음식 안전 ↔ 급여 가이드. 급여 가이드가 목록 맨 아래에 묻히지 않도록 상단에 둔다. */}
      <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
        {([['safety', t('tabSafety')], ['guide', t('tabGuide')]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors',
              view === v ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 펫이 없거나 1마리일 때만 종 탭 직접 노출 (두 화면 모두 종 기준이 필요) */}
      {showSpeciesTabs && (
        <div className="flex gap-2">
          {([['dog', `🐶 ${t('dog')}`], ['cat', `🐱 ${t('cat')}`]] as const).map(([sp, label]) => (
            <button
              key={sp}
              onClick={() => {
                setSpecies(sp)
                setFilter('전체')
                setCategory('전체')
                setSearch('')
                setBreedFilter('all')
              }}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors border',
                species === sp ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view === 'safety' && (
      <>
      {/* 검색 입력 — 입력 중에도 한 번에 지울 수 있는 ✕ 버튼을 둔다(커뮤니티·일정 검색과 통일).
          모바일에서 전체선택-삭제 없이 바로 초기화할 수 있어 마찰이 준다. */}
      <div className="relative">
        <input
          className="input pr-9"
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label={t('searchClear')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-full text-sm font-medium transition-colors', filterBtnStyle(f))}
          >
            {f}
          </button>
        ))}
      </div>

      {/* 분류 필터 */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border shrink-0 transition-colors',
              category === c ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
            )}
          >
            {c === '전체' ? '전체' : `${categoryIcon[c]} ${c}`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <CardSkeletonList count={5} />
      ) : isError ? (
        <EmptyState variant="error" title={t('loadError')} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🍽️"
          title={t('noResults')}
          hint={t('noResultsHint')}
          // 검색·안전·분류·견종 필터 조합으로 막다른 결과가 나오면, 어떤 필터가 걸렸는지
          // 사용자가 찾아 헤매지 않도록 한 번에 초기화하는 버튼을 준다(필터가 걸렸을 때만).
          action={
            (search || filter !== '전체' || category !== '전체' || breedFilter !== 'all') ? (
              <button
                onClick={() => { setSearch(''); setFilter('전체'); setCategory('전체'); setBreedFilter('all') }}
                className="btn-primary text-sm py-1.5 px-4"
              >
                {t('resetFilters')}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(({ food, safety }) => {
            const rule = ruleMap.get(food.id)
            const effectiveSafety = rule?.override_safety ?? safety.safety_level
            const hasOverride = rule && rule.override_safety !== safety.safety_level
            return (
              <div key={food.id} className={cn('rounded-2xl p-4 space-y-1.5', cardStyle[effectiveSafety])}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{food.name_ko}</span>
                  <div className="flex items-center gap-1.5">
                    {hasOverride && (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full line-through opacity-50', badgeStyle[safety.safety_level])}>
                        {safetyLabel[safety.safety_level]}
                      </span>
                    )}
                    <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', badgeStyle[effectiveSafety])}>
                      {safetyLabel[effectiveSafety]}
                    </span>
                  </div>
                </div>
                {safety.reason && <p className="text-sm text-gray-600">{safety.reason}</p>}
                {rule?.note && (
                  <p className={cn('text-xs px-2.5 py-1.5 rounded-lg font-medium', cautionBg[effectiveSafety])}>
                    {t('breedCaution', { breed: breedName ?? t('defaultBreed'), note: rule.note })}
                  </p>
                )}
                {!rule?.note && safety.caution && (
                  <p className={cn('text-xs px-2.5 py-1.5 rounded-lg', cautionBg[effectiveSafety])}>
                    {t('caution', { caution: safety.caution })}
                  </p>
                )}
                {safety.source && (
                  <p className="text-[11px] text-gray-400 text-right">{t('source', { source: safety.source })}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
      </>
      )}

      {/* 사료·급여 가이드 (급여량 계산기 + 사료/간식 정보) — 세그먼트에서 '급여 가이드' 선택 시 바로 노출 */}
      {view === 'guide' && (
      <section className="space-y-2">
        <p className="text-sm text-gray-500 leading-relaxed">{t('guideLead')}</p>
        <FeedCalculator
          key={calcPet?.id ?? species}
          species={species}
          defaultWeight={calcPet?.weight_kg ?? null}
          defaultFactor={toFeedFactor(calcAge?.lifeStage)}
          defaultOpen
        />
        {foodGuidesForSpecies(species).map(g =>
          // 체형(BCS)은 정적 안내 대신 단계형 자가진단 카드로 대체 — 갈비뼈·허리·복부 3문항 진단
          g.id === 'body-condition'
            ? <BcsAssessment key={g.id} />
            : <FoodGuideCard key={g.id} guide={g} />,
        )}
      </section>
      )}

      <div className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-3 mt-2">
        {t('disclaimer')}
      </div>

      {/* 하단 고정 제휴 배너(닫기 가능) */}
      <StickyAffiliateBanner species={species} context="foods" />
    </div>
  )
}
