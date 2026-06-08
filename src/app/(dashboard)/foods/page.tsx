'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { BreedFoodRule, FoodItem, FoodSafety, Pet, Species } from '@/types'

const FILTERS = ['전체', '안전', '주의', '위험'] as const
type Filter = typeof FILTERS[number]

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
  return (
    <Suspense fallback={<div className="px-4 py-12 text-center text-gray-400">불러오는 중...</div>}>
      <FoodsContent />
    </Suspense>
  )
}

function FoodsContent() {
  const searchParams = useSearchParams()
  const selectedPetId = searchParams.get('pet')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('전체')
  const [species, setSpecies] = useState<Species>('dog')
  const [breedFilter, setBreedFilter] = useState<string>('all')
  const initialized = useRef(false)
  const supabase = createClient()

  const { data: foods, isLoading } = useQuery({
    queryKey: ['foods'],
    queryFn: async () => {
      const { data } = await supabase
        .from('food_items')
        .select('*, food_safety(*)')
        .order('name_ko')
      return (data ?? []) as FoodRow[]
    },
  })

  // 내 반려동물 목록 (species + breed 정보 포함)
  const { data: myPets } = useQuery({
    queryKey: ['my-pets-food'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return [] as Pet[]
      const { data } = await supabase
        .from('pets')
        .select('id, name, species, breed_id, breed:breeds(name_ko)')
        .eq('user_id', user.id)
        .order('created_at')
      return (data ?? []) as unknown as Pet[]
    },
  })

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

  const filtered = rows.filter(({ food, safety }) => {
    const effectiveSafety = ruleMap.get(food.id)?.override_safety || safety.safety_level
    const matchSearch = food.name_ko.includes(search)
    const matchFilter = filterMap[filter] === null || effectiveSafety === filterMap[filter]
    return matchSearch && matchFilter
  })

  const filterBtnStyle = (f: Filter) => {
    if (filter !== f) return 'bg-white text-gray-500 border border-gray-200'
    return { '전체': 'bg-gray-700 text-white', '안전': 'bg-green-500 text-white', '주의': 'bg-amber-400 text-white', '위험': 'bg-red-500 text-white' }[f]
  }

  // 현재 선택된 펫 이름 (헤더에 표시)
  const activePet = selectedPetId ? myPets?.find(p => p.id === selectedPetId) : null
  const breedName = (activePet?.breed as unknown as { name_ko: string } | undefined)?.name_ko

  // 펫 선택기가 없는 경우(펫 1마리 이하)에만 종 탭 노출
  const showSpeciesTabs = !myPets || myPets.length <= 1

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">음식 안전 정보</h1>
        {activePet && (
          <span className="text-sm text-primary-600 font-medium">
            {activePet.species === 'cat' ? '🐱' : '🐶'} {activePet.name} 기준
          </span>
        )}
      </div>

      {/* 펫이 없거나 1마리일 때만 종 탭 직접 노출 */}
      {showSpeciesTabs && (
        <div className="flex gap-2">
          {([['dog', '🐶 강아지'], ['cat', '🐱 고양이']] as const).map(([sp, label]) => (
            <button
              key={sp}
              onClick={() => {
                setSpecies(sp)
                setFilter('전체')
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

      <input
        className="input"
        placeholder="음식 이름 검색..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

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

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">검색 결과가 없어요</div>
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
                    {breedName ?? '우리 아이'} 주의: {rule.note}
                  </p>
                )}
                {!rule?.note && safety.caution && (
                  <p className={cn('text-xs px-2.5 py-1.5 rounded-lg', cautionBg[effectiveSafety])}>
                    주의: {safety.caution}
                  </p>
                )}
                {safety.source && (
                  <p className="text-[11px] text-gray-400 text-right">출처: {safety.source}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-3 mt-2">
        ⓘ 본 정보는 ASPCA·AKC 등 공개 자료를 참고한 일반적인 안내이며, 개체별 건강 상태에 따라 다를 수 있어요.
        이상 증상이 있거나 급여 여부가 불확실하면 반드시 수의사와 상담하세요.
      </div>
    </div>
  )
}
