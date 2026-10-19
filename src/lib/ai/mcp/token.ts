import { createHash, randomBytes } from 'node:crypto'

/**
 * 개인 MCP 토큰 유틸.
 *
 * 평문 토큰은 발급 시 1회만 노출하고, DB 에는 sha256 해시만 저장한다(유출 시 원문 복구 불가).
 * 검증은 요청의 평문을 같은 방식으로 해시해 DB 해시와 대조한다.
 */

const PREFIX = 'pck_' // petcare key

/** 평문 토큰 > sha256 hex (결정적·순수). */
export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/** 새 토큰 발급 — 평문(1회 노출용)과 해시(DB 저장용)를 함께 돌려준다. */
export function generateToken(): { plaintext: string; hash: string } {
  const plaintext = PREFIX + randomBytes(24).toString('base64url')
  return { plaintext, hash: hashToken(plaintext) }
}

/** Authorization 헤더에서 Bearer 토큰을 뽑는다(순수). 없으면 null. */
export function parseBearer(header: string | null | undefined): string | null {
  if (!header) return null
  const m = header.match(/^Bearer\s+(.+)$/i)
  const tok = m?.[1]?.trim()
  return tok ? tok : null
}
