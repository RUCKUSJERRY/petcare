import { describe, it, expect } from 'vitest'
import { computeWeightInsight } from './weightInsight'

describe('computeWeightInsight', () => {
  it('빈 로그면 모두 비어있다', () => {
    const r = computeWeightInsight([], null)
    expect(r.trendPerWeek).toBeNull()
    expect(r.direction).toBe('flat')
    expect(r.projectedGoalDate).toBeNull()
    expect(r.suddenChange).toBeNull()
    expect(r.toGoal).toBeNull()
  })

  it('표본 1개면 추세 없음, toGoal은 계산', () => {
    const r = computeWeightInsight([{ weight_kg: 5, measured_on: '2026-01-01' }], 4)
    expect(r.trendPerWeek).toBeNull()
    expect(r.toGoal).toBe(1) // 5 - 4
  })

  it('일정하게 증가하면 direction=up, 주당 추세 계산', () => {
    const logs = [
      { weight_kg: 5.0, measured_on: '2026-01-01' },
      { weight_kg: 5.0 + 0.1, measured_on: '2026-01-08' }, // +0.1/주
      { weight_kg: 5.0 + 0.2, measured_on: '2026-01-15' },
    ]
    const r = computeWeightInsight(logs, null)
    expect(r.direction).toBe('up')
    expect(r.trendPerWeek).toBeCloseTo(0.1, 2)
  })

  it('감소 추세에서 목표가 아래면 도달 예상일이 나온다', () => {
    const logs = [
      { weight_kg: 6.0, measured_on: '2026-01-01' },
      { weight_kg: 5.5, measured_on: '2026-01-08' }, // -0.5/주 = -0.0714/일
    ]
    const r = computeWeightInsight(logs, 5.0)
    expect(r.direction).toBe('down')
    expect(r.toGoal).toBeCloseTo(0.5, 2) // 5.5 - 5.0
    // 최신 5.5에서 5.0까지 0.5kg, 주당 0.5 → 약 1주(7일) 후 ≈ 2026-01-15
    expect(r.projectedGoalDate).toBe('2026-01-15')
  })

  it('추세가 목표 반대 방향이면 도달 예상일 없음', () => {
    const logs = [
      { weight_kg: 5.0, measured_on: '2026-01-01' },
      { weight_kg: 5.5, measured_on: '2026-01-08' }, // 증가 중
    ]
    const r = computeWeightInsight(logs, 4.0) // 목표는 아래인데 늘고 있음
    expect(r.projectedGoalDate).toBeNull()
  })

  it('유지 수준의 미세 변동은 flat', () => {
    const logs = [
      { weight_kg: 5.00, measured_on: '2026-01-01' },
      { weight_kg: 5.001, measured_on: '2026-01-08' },
    ]
    expect(computeWeightInsight(logs, null).direction).toBe('flat')
  })

  it('직전 대비 7% 이상이면 급변 경고', () => {
    const logs = [
      { weight_kg: 5.0, measured_on: '2026-01-01' },
      { weight_kg: 5.5, measured_on: '2026-01-10' }, // +10%
    ]
    const r = computeWeightInsight(logs, null)
    expect(r.suddenChange).not.toBeNull()
    expect(r.suddenChange!.up).toBe(true)
    expect(r.suddenChange!.pct).toBeCloseTo(0.1, 2)
  })

  it('측정 간격이 한 달을 넘으면 급변으로 보지 않음', () => {
    const logs = [
      { weight_kg: 5.0, measured_on: '2026-01-01' },
      { weight_kg: 5.5, measured_on: '2026-03-01' }, // +10%지만 59일 간격
    ]
    expect(computeWeightInsight(logs, null).suddenChange).toBeNull()
  })

  it('같은 날 두 번 잰 차이(식전/식후 등)는 급변 경고로 보지 않음', () => {
    const logs = [
      { weight_kg: 5.0, measured_on: '2026-01-01' },
      { weight_kg: 5.5, measured_on: '2026-01-01' }, // 같은 날 +10% → 오경고 방지
    ]
    expect(computeWeightInsight(logs, null).suddenChange).toBeNull()
  })

  it('추세가 유지(flat)면 도달 예상일을 함께 띄우지 않는다(모순 방지)', () => {
    const logs = [
      { weight_kg: 5.000, measured_on: '2026-01-01' },
      { weight_kg: 5.001, measured_on: '2026-01-08' }, // 사실상 유지지만 아주 미세하게 증가
    ]
    const r = computeWeightInsight(logs, 5.2) // 목표는 위(증가 방향과 일치)
    expect(r.direction).toBe('flat')
    expect(r.projectedGoalDate).toBeNull()
  })
})
