import { describe, expect, it } from 'vitest'
import { computeCohortRetention, computeOnboardingFunnel } from './kpi'

const NOW = Date.parse('2026-11-16T12:00:00Z')
const H = 60 * 60 * 1000
const D = 24 * H
const iso = (ms: number) => new Date(ms).toISOString()

describe('computeOnboardingFunnel', () => {
  it('단계별로 빠지는 인원을 센다', () => {
    const users = [
      { id: 'a', created_at: iso(NOW - 10 * D) }, // 아이 + 첫 기록 + 다른 날 재기록
      { id: 'b', created_at: iso(NOW - 5 * D) },  // 아이 + 첫 기록(같은 날만)
      { id: 'c', created_at: iso(NOW - 3 * D) },  // 아이만
      { id: 'd', created_at: iso(NOW - 1 * D) },  // 가입만
      { id: 'old', created_at: iso(NOW - 40 * D) }, // 창 밖
    ]
    const acts = [
      { user_id: 'a', created_at: iso(NOW - 10 * D + 2 * H) },
      { user_id: 'a', created_at: iso(NOW - 8 * D) },
      { user_id: 'b', created_at: iso(NOW - 5 * D + 4 * H) },
      { user_id: 'b', created_at: iso(NOW - 5 * D + 5 * H) },
      { user_id: 'old', created_at: iso(NOW - 2 * D) },
    ]
    const f = computeOnboardingFunnel(users, ['a', 'b', 'c', 'old'], acts, NOW)
    expect(f.signups).toBe(4)
    expect(f.withPet).toBe(3)
    expect(f.firstRecord).toBe(2)
    expect(f.secondDay).toBe(1)
    expect(f.rates).toEqual({ withPet: 75, firstRecord: 50, secondDay: 25 })
    expect(f.medianHoursToFirstRecord).toBe(3) // (2h, 4h) 중앙값
  })

  it('가입 전 기록(초대받아 합류한 공동관리 등)은 첫 기록으로 치지 않는다', () => {
    const users = [{ id: 'a', created_at: iso(NOW - 2 * D) }]
    const acts = [{ user_id: 'a', created_at: iso(NOW - 3 * D) }]
    const f = computeOnboardingFunnel(users, [], acts, NOW)
    expect(f.firstRecord).toBe(0)
    expect(f.medianHoursToFirstRecord).toBeNull()
  })

  it('재기록 판정은 KST 날짜 기준 — UTC 같은 날이라도 KST 자정을 넘으면 다른 날', () => {
    const signup = Date.parse('2026-11-10T13:00:00Z') // KST 11-10 22:00
    const users = [{ id: 'a', created_at: iso(signup) }]
    const acts = [
      { user_id: 'a', created_at: '2026-11-10T14:00:00Z' }, // KST 11-10 23:00
      { user_id: 'a', created_at: '2026-11-10T15:30:00Z' }, // KST 11-11 00:30
    ]
    expect(computeOnboardingFunnel(users, ['a'], acts, NOW).secondDay).toBe(1)
  })

  it('가입자가 없으면 비율 0, 중앙값 null', () => {
    const f = computeOnboardingFunnel([], [], [], NOW)
    expect(f.signups).toBe(0)
    expect(f.rates.firstRecord).toBe(0)
    expect(f.medianHoursToFirstRecord).toBeNull()
  })
})

describe('computeCohortRetention', () => {
  it('끝나지 않은 주차는 null, 끝난 주차만 잔존율 계산', () => {
    const users = [
      { id: 'a', created_at: iso(NOW - 15 * D) }, // 2주 전 코호트 (weeksAgo=2)
      { id: 'b', created_at: iso(NOW - 16 * D) },
    ]
    const acts = [
      { user_id: 'a', created_at: iso(NOW - 15 * D + H) }, // 0주차
      { user_id: 'b', created_at: iso(NOW - 16 * D + H) }, // 0주차
      { user_id: 'a', created_at: iso(NOW - 6 * D) },      // a: 1주차(가입+9일)
    ]
    const rows = computeCohortRetention(users, acts, NOW, 3, 4)
    expect(rows.map(r => r.size)).toEqual([0, 0, 2])
    expect(rows[2].week).toEqual([100, 50, null, null, null])
    expect(rows[0].week.every(v => v === null)).toBe(true)
  })

  it('코호트 안에서 주차가 끝난 사람만 분모에 넣는다', () => {
    const users = [
      { id: 'early', created_at: iso(NOW - 13.5 * D) }, // 0주차 끝남
      { id: 'late', created_at: iso(NOW - 7.5 * D) },   // 0주차 끝남, 1주차 진행 중
    ]
    const acts = [{ user_id: 'early', created_at: iso(NOW - 8 * D) }] // early 의 0주차(가입+5.5일)
    const [, w1] = computeCohortRetention(users, acts, NOW, 2, 1)
    expect(w1.size).toBe(2)
    expect(w1.week).toEqual([50, null])
  })
})
