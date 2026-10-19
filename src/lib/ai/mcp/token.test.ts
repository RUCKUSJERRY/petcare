import { describe, expect, it } from 'vitest'
import { hashToken, generateToken, parseBearer } from './token'

describe('hashToken', () => {
  it('결정적 sha256 hex(64자)', () => {
    const h = hashToken('pck_abc')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken('pck_abc')).toBe(h) // 같은 입력 같은 해시
  })
  it('다른 입력은 다른 해시', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'))
  })
})

describe('generateToken', () => {
  it('pck_ 접두사 평문 + 그 해시', () => {
    const { plaintext, hash } = generateToken()
    expect(plaintext.startsWith('pck_')).toBe(true)
    expect(hash).toBe(hashToken(plaintext))
  })
  it('매번 다른 토큰', () => {
    expect(generateToken().plaintext).not.toBe(generateToken().plaintext)
  })
})

describe('parseBearer', () => {
  it('Bearer 토큰 추출(대소문자 무관)', () => {
    expect(parseBearer('Bearer pck_xyz')).toBe('pck_xyz')
    expect(parseBearer('bearer pck_xyz')).toBe('pck_xyz')
  })
  it('없거나 형식 불일치면 null', () => {
    expect(parseBearer(null)).toBeNull()
    expect(parseBearer(undefined)).toBeNull()
    expect(parseBearer('Token abc')).toBeNull()
    expect(parseBearer('Bearer ')).toBeNull()
  })
})
