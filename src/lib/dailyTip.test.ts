import { describe, expect, it } from 'vitest'
import { getDailyTip, tipPool, tipTargetForPets } from './dailyTip'
import { calcPetAge, stageLabel } from './utils'

describe('dailyTip', () => {
  it('종별로 비어있지 않은 팁 풀을 만든다', () => {
    expect(tipPool('dog').length).toBeGreaterThan(0)
    expect(tipPool('cat').length).toBeGreaterThan(0)
  })

  it('고양이 풀은 고양이 전용 콘텐츠(수분·습식)를 포함한다', () => {
    const catTexts = tipPool('cat').map(t => t.text).join('\n')
    expect(catTexts).toContain('습식')
  })

  it('같은 날짜에는 항상 같은 팁을 고른다(결정적)', () => {
    const a = getDailyTip('dog', '2026-07-24')
    const b = getDailyTip('dog', '2026-07-24')
    expect(a).not.toBeNull()
    expect(a).toEqual(b)
  })

  it('날짜가 바뀌면 대체로 다른 팁으로 순환한다', () => {
    // 30일치 팁을 모으면 최소 2종류 이상은 나와야 한다(고정 팁 버그 방지).
    const seen = new Set<string>()
    for (let d = 1; d <= 30; d++) {
      const tip = getDailyTip('dog', `2026-01-${String(d).padStart(2, '0')}`)
      if (tip) seen.add(tip.text)
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('고른 팁은 항상 유효한 가이드 링크를 가진다', () => {
    const tip = getDailyTip('dog', '2026-03-15')
    expect(tip).not.toBeNull()
    // getDailyTip 은 날짜의 달로 계절 팁(/health)도 함께 섞으므로 /health 도 유효한 링크다.
    expect(['/care', '/foods', '/health']).toContain(tip!.href)
  })

  it('getDailyTip 은 날짜의 달로 계절 케어 팁을 풀에 섞는다', () => {
    // tipPool 에 month 를 주면 계절 팁(/health)이 추가되고, 안 주면 없다.
    const withMonth = tipPool('dog', undefined, 7) // 7월 = 여름
    const withoutMonth = tipPool('dog')
    expect(withMonth.length).toBeGreaterThan(withoutMonth.length)
    expect(withMonth.some(t => t.category.includes('여름'))).toBe(true)
    expect(withoutMonth.some(t => t.href === '/health')).toBe(false)
  })

  it('여름·겨울 팁 풀은 서로 다른 계절 팁을 갖는다', () => {
    const summer = tipPool('dog', undefined, 7).filter(t => t.href === '/health').map(t => t.text)
    const winter = tipPool('dog', undefined, 1).filter(t => t.href === '/health').map(t => t.text)
    expect(summer).not.toEqual(winter)
  })

  it('생애단계를 넘기면 그 단계 맞춤 팁(건강 체크리스트)이 풀에 더해진다', () => {
    const base = tipPool('dog')
    const puppy = tipPool('dog', '퍼피')
    // 단계 팁이 추가되므로 풀이 더 커지고, 건강 정보(/health) 링크 팁이 생긴다.
    expect(puppy.length).toBeGreaterThan(base.length)
    expect(puppy.some(t => t.href === '/health')).toBe(true)
    expect(base.some(t => t.href === '/health')).toBe(false)
  })

  it('단계를 안 주면 기존과 동일(종 공통 팁만 — /health 없음)', () => {
    const pool = tipPool('cat')
    expect(pool.every(t => t.href === '/care' || t.href === '/foods')).toBe(true)
  })

  it('퍼피와 시니어는 서로 다른 단계 맞춤 팁을 갖는다', () => {
    const puppyHealth = tipPool('dog', '퍼피').filter(t => t.href === '/health').map(t => t.text)
    const seniorHealth = tipPool('dog', '시니어').filter(t => t.href === '/health').map(t => t.text)
    expect(puppyHealth).not.toEqual(seniorHealth)
  })
})

// 데일리 팁 푸시(cron)가 홈 카드와 같은 입력으로 getDailyTip 을 부르게 하는 대표 추출.
// stage 를 안 넘겨 홈과 다른 팁이 뜨던(그리고 나이대 맞춤 팁이 푸시에서 빠지던) 결함 회귀 방지.
describe('tipTargetForPets', () => {
  it('단일 반려동물: 그 아이의 종·생애단계를 그대로 돌려준다(홈 카드와 동일 입력)', () => {
    const r = tipTargetForPets([{ species: 'dog', birth_year: 2024, birth_month: 1 }])
    expect(r.species).toBe('dog')
    // 홈 카드와 같은 함수(calcPetAge>stageLabel)로 계산되어야 한다(현재 날짜 기준이라 함께 움직임).
    expect(r.stage).toBe(stageLabel(calcPetAge(2024, 1, 'dog')))
  })

  it('다수 종으로 대표 종을 정한다(고양이>강아지면 cat)', () => {
    const pets = [
      { species: 'cat' as const, birth_year: 2020, birth_month: 3 },
      { species: 'cat' as const, birth_year: 2019, birth_month: 6 },
      { species: 'dog' as const, birth_year: 2021, birth_month: 9 },
    ]
    const r = tipTargetForPets(pets)
    expect(r.species).toBe('cat')
    // 대표 생애단계는 대표 종(고양이)의 '목록 첫' 아이 기준
    expect(r.stage).toBe(stageLabel(calcPetAge(2020, 3, 'cat')))
  })

  it('종 수 동점이면 강아지로 폴백한다', () => {
    const r = tipTargetForPets([
      { species: 'cat', birth_year: 2020, birth_month: 1 },
      { species: 'dog', birth_year: 2020, birth_month: 1 },
    ])
    expect(r.species).toBe('dog')
  })

  it('반려동물이 없으면 dog + stage 미지정(기존 종만 팁과 동일 동작)', () => {
    const r = tipTargetForPets([])
    expect(r.species).toBe('dog')
    expect(r.stage).toBeUndefined()
  })

  it('생년 미상이면 생애단계는 미상', () => {
    const r = tipTargetForPets([{ species: 'dog', birth_year: null, birth_month: null }])
    expect(r.stage).toBe('미상')
  })

  it('홈 카드와 푸시가 같은 (종·단계)로 같은 날 같은 팁을 고른다', () => {
    const date = '2026-07-24'
    // 홈 카드 경로: 선택된 아이의 종·단계로 getDailyTip
    const homeTip = getDailyTip('dog', date, stageLabel(calcPetAge(2024, 1, 'dog')))
    // 푸시 경로: 같은 아이 1마리에서 대표 입력을 뽑아 getDailyTip
    const { species, stage } = tipTargetForPets([{ species: 'dog', birth_year: 2024, birth_month: 1 }])
    const pushTip = getDailyTip(species, date, stage)
    expect(pushTip).toEqual(homeTip)
  })
})
