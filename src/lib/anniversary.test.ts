import { describe, it, expect } from 'vitest'
import { anniversariesToday, formatAnniversaryPush } from './anniversary'

const base = { birth_year: null, birth_month: null, birth_day: null, adopted_on: null }

describe('anniversariesToday — 생일', () => {
  it('생일 당일이면 만 나이와 함께 생일 이벤트를 낸다', () => {
    const ev = anniversariesToday({ ...base, birth_year: 2020, birth_month: 8, birth_day: 1 }, '2026-08-01')
    expect(ev).toEqual([{ kind: 'birthday', years: 6 }])
  })

  it('출생연도를 모르면 나이는 null 로 둔다', () => {
    const ev = anniversariesToday({ ...base, birth_month: 8, birth_day: 1 }, '2026-08-01')
    expect(ev).toEqual([{ kind: 'birthday', years: null }])
  })

  it('생일 일(day)을 모르면 챙기지 않는다(정확한 날 미상)', () => {
    const ev = anniversariesToday({ ...base, birth_year: 2020, birth_month: 8 }, '2026-08-01')
    expect(ev).toEqual([])
  })

  it('다른 날이면 이벤트 없음', () => {
    const ev = anniversariesToday({ ...base, birth_year: 2020, birth_month: 8, birth_day: 1 }, '2026-07-31')
    expect(ev).toEqual([])
  })

  it('2/29 생일은 비윤년엔 2/28 에 챙긴다', () => {
    const ev = anniversariesToday({ ...base, birth_year: 2020, birth_month: 2, birth_day: 29 }, '2026-02-28')
    expect(ev).toEqual([{ kind: 'birthday', years: 6 }])
  })

  it('2/29 생일은 윤년엔 2/29 에 챙긴다(2/28 아님)', () => {
    expect(anniversariesToday({ ...base, birth_year: 2020, birth_month: 2, birth_day: 29 }, '2028-02-29'))
      .toEqual([{ kind: 'birthday', years: 8 }])
    expect(anniversariesToday({ ...base, birth_year: 2020, birth_month: 2, birth_day: 29 }, '2028-02-28'))
      .toEqual([])
  })
})

describe('anniversariesToday — 입양 기념일', () => {
  it('입양 월·일이 오늘과 같고 1주년 이상이면 입양 기념일', () => {
    const ev = anniversariesToday({ ...base, adopted_on: '2023-08-01' }, '2026-08-01')
    expect(ev).toEqual([{ kind: 'adoption', years: 3 }])
  })

  it('입양 당일(0주년)은 기념일로 보지 않는다', () => {
    const ev = anniversariesToday({ ...base, adopted_on: '2026-08-01' }, '2026-08-01')
    expect(ev).toEqual([])
  })

  it('입양일 형식이 잘못되면 무시', () => {
    const ev = anniversariesToday({ ...base, adopted_on: '2023/08/01' }, '2026-08-01')
    expect(ev).toEqual([])
  })
})

describe('anniversariesToday — 생일과 입양이 같은 날', () => {
  it('둘 다 오늘이면 생일·입양 이벤트를 모두 낸다(생일 먼저)', () => {
    const ev = anniversariesToday(
      { birth_year: 2019, birth_month: 8, birth_day: 1, adopted_on: '2022-08-01' },
      '2026-08-01',
    )
    expect(ev).toEqual([
      { kind: 'birthday', years: 7 },
      { kind: 'adoption', years: 4 },
    ])
  })
})

describe('formatAnniversaryPush', () => {
  it('대상이 없으면 null', () => {
    expect(formatAnniversaryPush([])).toBeNull()
  })

  it('생일 한 건 — 나이 있으면 N번째 생일 문구', () => {
    const msg = formatAnniversaryPush([{ name: '초코', kind: 'birthday', years: 6 }])
    expect(msg?.title).toContain('초코')
    expect(msg?.title).toContain('생일')
    expect(msg?.body).toContain('6번째')
  })

  it('생일 한 건 — 나이 미상이면 N번째 없이', () => {
    const msg = formatAnniversaryPush([{ name: '초코', kind: 'birthday', years: null }])
    expect(msg?.body).not.toContain('번째')
    expect(msg?.body).toContain('생일')
  })

  it('입양 한 건 — 주년 문구', () => {
    const msg = formatAnniversaryPush([{ name: '나비', kind: 'adoption', years: 3 }])
    expect(msg?.title).toContain('3주년')
    expect(msg?.body).toContain('나비')
  })

  it('여러 건이면 하나로 묶어 모든 이름을 담는다', () => {
    const msg = formatAnniversaryPush([
      { name: '초코', kind: 'birthday', years: 6 },
      { name: '나비', kind: 'adoption', years: 3 },
    ])
    expect(msg?.body).toContain('초코')
    expect(msg?.body).toContain('나비')
    expect(msg?.body).toContain('3주년')
  })
})
