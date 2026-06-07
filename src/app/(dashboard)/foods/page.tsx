'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { BreedFoodRule, FoodItem } from '@/types'

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

export default function FoodsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('전체')
  const [breedFilter, setBreedFilter] = useState<string>('all')
  const supabase = createClient()

  const { data: foods, isLoading } = useQuery({
    queryKey: ['foods'],
    queryFn: async () => {
      const { data } = await supabase.from('food_items').select('*').order('name_ko')
      return (data ?? []) as FoodItem[]
    },
  })

  // 내 반려동물의 견종 ID 목록
  const { data: myBreeds } = useQuery({
    queryKey: ['my-breeds'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data } = await supabase
        .from('pets')
        .select('breed_id, breed:breeds(name_ko)')
        .eq('user_id', user.id)
      type Row = { breed_id: string; breed?: { name_ko: string } }
      const rows = (data ?? []) as unknown as Row[]
      const unique = Array.from(
        new Map(rows.filter(r => r.breed_id).map(r => [r.breed_id, r.breed?.name_ko ?? ''])).entries()
      ).map(([id, name]) => ({ id, name }))
      return unique
    },
  })

  // 선택된 견종의 음식 규칙
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

  const filtered = (foods ?? []).filter(f => {
    const effectiveSafety = ruleMap.get(f.id)?.override_safety ?? f.safety_level
    const matchSearch = f.name_ko.includes(search)
    const matchFilter = filterMap[filter] === null || effectiveSafety === filterMap[filter]
    return matchSearch && matchFilter
  })

  const filterBtnStyle = (f: Filter) => {
    if (filter !== f) return 'bg-white text-gray-500 border border-gray-200'
    return { '전체': 'bg-gray-700 text-white', '안전': 'bg-green-500 text-white', '주의': 'bg-amber-400 text-white', '위험': 'bg-red-500 text-white' }[f]
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">음식 안전 정보</h1>

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

      {/* 견종 필터 */}
      {myBreeds && myBreeds.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium shrink-0">우리 아이 기준:</span>
          <button
            onClick={() => setBreedFilter('all')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
              breedFilter === 'all'
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-gray-600 border-gray-200'
            )}
          >
            전체 기준
          </button>
          {myBreeds.map(b => (
            <button
              key={b.id}
              onClick={() => setBreedFilter(b.id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                breedFilter === b.id
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-200'
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">검색 결과가 없어요</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(food => {
            const rule = ruleMap.get(food.id)
            const effectiveSafety = rule?.override_safety ?? food.safety_level
            const hasOverride = rule && rule.override_safety !== food.safety_level
            return (
              <div key={food.id} className={cn('rounded-2xl p-4 space-y-1.5', cardStyle[effectiveSafety])}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{food.name_ko}</span>
                  <div className="flex items-center gap-1.5">
                    {hasOverride && (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full line-through opacity-50', badgeStyle[food.safety_level])}>
                        {safetyLabel[food.safety_level]}
                      </span>
                    )}
                    <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', badgeStyle[effectiveSafety])}>
                      {safetyLabel[effectiveSafety]}
                    </span>
                  </div>
                </div>
                {food.reason && <p className="text-sm text-gray-600">{food.reason}</p>}
                {rule?.note && (
                  <p className={cn('text-xs px-2.5 py-1.5 rounded-lg font-medium', cautionBg[effectiveSafety])}>
                    견종 주의: {rule.note}
                  </p>
                )}
                {!rule?.note && food.caution && (
                  <p className={cn('text-xs px-2.5 py-1.5 rounded-lg', cautionBg[effectiveSafety])}>
                    주의: {food.caution}
                  </p>
                )}
                {food.source && (
                  <p className="text-[11px] text-gray-400 text-right">출처: {food.source}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 면책 안내 */}
      <div className="text-xs text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-3 mt-2">
        ⓘ 본 정보는 ASPCA·AKC 등 공개 자료를 참고한 일반적인 안내이며, 개체별 건강 상태에 따라 다를 수 있어요.
        이상 증상이 있거나 급여 여부가 불확실하면 반드시 수의사와 상담하세요.
      </div>
    </div>
  )
}
