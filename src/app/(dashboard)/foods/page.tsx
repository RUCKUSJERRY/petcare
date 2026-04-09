'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { FoodItem } from '@/types'

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
  const supabase = createClient()

  const { data: foods, isLoading } = useQuery({
    queryKey: ['foods'],
    queryFn: async () => {
      const { data } = await supabase.from('food_items').select('*').order('name_ko')
      return (data ?? []) as FoodItem[]
    },
  })

  const filtered = (foods ?? []).filter(f => {
    const matchSearch = f.name_ko.includes(search)
    const matchFilter = filterMap[filter] === null || f.safety_level === filterMap[filter]
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

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">검색 결과가 없어요</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(food => (
            <div key={food.id} className={cn('rounded-2xl p-4 space-y-1.5', cardStyle[food.safety_level])}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">{food.name_ko}</span>
                <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', badgeStyle[food.safety_level])}>
                  {safetyLabel[food.safety_level]}
                </span>
              </div>
              {food.reason && <p className="text-sm text-gray-600">{food.reason}</p>}
              {food.caution && (
                <p className={cn('text-xs px-2.5 py-1.5 rounded-lg', cautionBg[food.safety_level])}>
                  주의: {food.caution}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
