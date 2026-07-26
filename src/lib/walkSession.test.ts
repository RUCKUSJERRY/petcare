import { describe, it, expect } from 'vitest'
import {
  isValidSession,
  isRecoverable,
  WALK_SESSION_TTL_MS,
  type WalkSession,
} from './walkSession'

const base: WalkSession = {
  v: 1,
  startedAt: 1000,
  elapsedMs: 5000,
  distance: 120,
  path: [
    [37.5, 127.0],
    [37.501, 127.001],
  ],
  lastPos: [37.501, 127.001],
  petId: 'pet-1',
  savedAt: 10000,
}

describe('isValidSession', () => {
  it('accepts a well-formed session', () => {
    expect(isValidSession(base)).toBe(true)
  })

  it('accepts a session with no lastPos and empty petId', () => {
    expect(isValidSession({ ...base, lastPos: null, petId: '' })).toBe(true)
  })

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['wrong version', { ...base, v: 2 }],
    ['missing startedAt', { ...base, startedAt: undefined }],
    ['non-array path', { ...base, path: 'x' }],
    ['malformed point', { ...base, path: [[1]] }],
    ['non-numeric point member', { ...base, path: [['a', 1]] }],
    ['numeric petId', { ...base, petId: 3 }],
  ])('rejects %s', (_label, value) => {
    expect(isValidSession(value)).toBe(false)
  })
})

describe('isRecoverable', () => {
  it('recovers a recent session with points', () => {
    expect(isRecoverable(base, base.savedAt + 1000)).toBe(true)
  })

  it('does not recover once past the TTL', () => {
    expect(isRecoverable(base, base.savedAt + WALK_SESSION_TTL_MS + 1)).toBe(false)
  })

  it('recovers exactly at the TTL boundary', () => {
    expect(isRecoverable(base, base.savedAt + WALK_SESSION_TTL_MS)).toBe(true)
  })

  it('does not recover an empty (no points) session', () => {
    expect(isRecoverable({ ...base, path: [] }, base.savedAt + 1000)).toBe(false)
  })
})
