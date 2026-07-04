import { describe, it, expect } from 'vitest'
import { isPremiumActive } from './plan'

describe('isPremiumActive', () => {
  const now = new Date('2026-07-04T00:00:00Z')

  it('free plan is never premium', () => {
    expect(isPremiumActive('free', null, now)).toBe(false)
    expect(isPremiumActive('free', '2999-01-01', now)).toBe(false)
  })

  it('null/undefined plan is not premium', () => {
    expect(isPremiumActive(null, null, now)).toBe(false)
    expect(isPremiumActive(undefined, '2999-01-01', now)).toBe(false)
  })

  it('premium with no expiry (무기한) is active', () => {
    expect(isPremiumActive('premium', null, now)).toBe(true)
    expect(isPremiumActive('premium', undefined, now)).toBe(true)
  })

  it('premium with future expiry is active', () => {
    expect(isPremiumActive('premium', '2026-08-04T00:00:00Z', now)).toBe(true)
  })

  it('premium with past expiry is not active', () => {
    expect(isPremiumActive('premium', '2026-07-03T23:59:59Z', now)).toBe(false)
  })
})
