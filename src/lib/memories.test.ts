import { describe, it, expect } from 'vitest'
import { memoryAge, candidateMemoryDates, selectMemories, type MemorySource } from './memories'

describe('memoryAge', () => {
  it('같은 월/일 지난 해면 N년 전 오늘', () => {
    expect(memoryAge('2023-11-01', '2026-11-01')).toEqual({ yearsAgo: 3, monthsAgo: 0 })
    expect(memoryAge('2025-11-01', '2026-11-01')).toEqual({ yearsAgo: 1, monthsAgo: 0 })
  })

  it('같은 일 지난 달이면 N개월 전 오늘(월이 다를 때만)', () => {
    expect(memoryAge('2026-08-01', '2026-11-01')).toEqual({ yearsAgo: 0, monthsAgo: 3 })
    // 해를 넘겨도 12개월 미만이면 개월로
    expect(memoryAge('2025-12-15', '2026-11-15')).toEqual({ yearsAgo: 0, monthsAgo: 11 })
  })

  it('오늘·미래·관계없는 날은 null', () => {
    expect(memoryAge('2026-11-01', '2026-11-01')).toBeNull() // 오늘
    expect(memoryAge('2027-11-01', '2026-11-01')).toBeNull() // 미래(해)
    expect(memoryAge('2026-11-02', '2026-11-01')).toBeNull() // 다른 날
    expect(memoryAge('2026-10-15', '2026-11-01')).toBeNull() // 일이 다름
  })

  it('정확히 12개월 전(같은 월/일)은 개월이 아니라 1년으로', () => {
    expect(memoryAge('2025-11-01', '2026-11-01')).toEqual({ yearsAgo: 1, monthsAgo: 0 })
  })

  it('2/29 기록은 2/29 당일에만 되살아난다(비윤년엔 매칭 안 됨)', () => {
    expect(memoryAge('2024-02-29', '2028-02-29')).toEqual({ yearsAgo: 4, monthsAgo: 0 })
    expect(memoryAge('2024-02-29', '2026-02-28')).toBeNull()
  })

  it('잘못된 입력은 null', () => {
    expect(memoryAge('', '2026-11-01')).toBeNull()
    expect(memoryAge('2026-11-01', '')).toBeNull()
  })
})

describe('candidateMemoryDates', () => {
  it('지난 해 같은 월/일 + 지난 달 같은 일을 후보로 낸다', () => {
    const dates = candidateMemoryDates('2026-11-01', { maxYears: 2, maxMonths: 3 })
    expect(dates).toContain('2025-11-01') // 1년 전
    expect(dates).toContain('2024-11-01') // 2년 전
    expect(dates).toContain('2026-10-01') // 1개월 전
    expect(dates).toContain('2026-09-01') // 2개월 전
    expect(dates).toContain('2026-08-01') // 3개월 전
    // 오름차순 정렬·중복 없음
    expect(dates).toEqual(Array.from(new Set(dates)).sort())
  })

  it('그 달에 없는 날(31일)은 후보에서 빠진다', () => {
    const dates = candidateMemoryDates('2026-10-31', { maxYears: 0, maxMonths: 3 })
    // 9/31·6/31 은 존재하지 않음 → 제외, 8/31 은 존재 → 포함
    expect(dates).not.toContain('2026-09-31')
    expect(dates).toContain('2026-08-31')
  })

  it('비윤년 2/29 는 지난 해 후보에서 제외', () => {
    const dates = candidateMemoryDates('2026-02-28', { maxYears: 3, maxMonths: 0 })
    expect(dates).toContain('2025-02-28')
    expect(dates).toContain('2024-02-28')
    expect(dates).not.toContain('2023-02-29')
  })
})

describe('selectMemories', () => {
  const base = (over: Partial<MemorySource>): MemorySource => ({
    id: 'x', kind: 'record', dateStr: '2025-11-01', title: '산책', ...over,
  })

  it('그날의 오늘만 고르고, 관계없는 날은 버린다', () => {
    const got = selectMemories([
      base({ id: 'a', dateStr: '2025-11-01' }),      // 1년 전 오늘
      base({ id: 'b', dateStr: '2026-10-20' }),      // 관계없음
      base({ id: 'c', dateStr: '2026-08-01' }),      // 3개월 전 오늘
    ], '2026-11-01')
    expect(got.map(m => m.id).sort()).toEqual(['a', 'c'])
  })

  it('사진 > 메모 > 최신 순으로 정렬', () => {
    const got = selectMemories([
      base({ id: 'plain', dateStr: '2024-11-01' }),
      base({ id: 'memo', dateStr: '2023-11-01', memo: '첫 산책' }),
      base({ id: 'photo', dateStr: '2022-11-01', photoUrl: 'p.jpg' }),
    ], '2026-11-01')
    expect(got.map(m => m.id)).toEqual(['photo', 'memo', 'plain'])
  })

  it('max 로 상위 N 건만', () => {
    const src = Array.from({ length: 10 }, (_, i) => base({ id: `r${i}`, dateStr: `${2025 - i}-11-01` }))
    expect(selectMemories(src, '2026-11-01', { max: 3 })).toHaveLength(3)
  })

  it('빈 입력은 빈 배열', () => {
    expect(selectMemories([], '2026-11-01')).toEqual([])
  })
})
