import type { WalkPoint } from '@/types'

// 진행 중이던 산책을 기기(localStorage)에 저장해, 앱이 실수로 종료되거나
// 새로고침돼도 이어서 기록할 수 있게 한다. 웹 앱은 백그라운드에서 GPS를
// 계속 돌릴 수 없으므로, "다시 시작하지 않아도 되게" 복구를 지원하는 방식으로 접근한다.
const KEY = 'petcare:walk-session:v1'

// 저장된 진행 중 산책이 이 시간보다 오래되면 복구 대상에서 제외한다(하루).
// 어제 하다 만 산책을 오늘 이어서 제안하면 오히려 혼란스럽기 때문.
export const WALK_SESSION_TTL_MS = 24 * 60 * 60 * 1000

export interface WalkSession {
  v: 1
  startedAt: number // 최초 시작 벽시계(ms)
  // 정지 구간을 제외한 누적 진행 시간(ms). 저장 시점에 현재 진행 구간까지 닫아서 기록하므로,
  // 복구 시에는 항상 '일시정지' 상태에서 이어가면 되고 앱이 꺼져 있던 시간은 포함되지 않는다.
  elapsedMs: number
  distance: number // m
  path: WalkPoint[]
  lastPos: WalkPoint | null
  petId: string
  savedAt: number // 마지막 저장 벽시계(ms)
}

function isPoint(x: unknown): x is WalkPoint {
  return (
    Array.isArray(x) &&
    x.length === 2 &&
    typeof x[0] === 'number' &&
    typeof x[1] === 'number'
  )
}

export function isValidSession(x: unknown): x is WalkSession {
  if (!x || typeof x !== 'object') return false
  const s = x as Record<string, unknown>
  return (
    s.v === 1 &&
    typeof s.startedAt === 'number' &&
    typeof s.elapsedMs === 'number' &&
    typeof s.distance === 'number' &&
    typeof s.savedAt === 'number' &&
    typeof s.petId === 'string' &&
    (s.lastPos === null || isPoint(s.lastPos)) &&
    Array.isArray(s.path) &&
    s.path.every(isPoint)
  )
}

// 저장된 산책이 아직 복구를 제안할 만큼 최근인지. 빈(기록점 0) 산책은 복구할 게 없으므로 제외.
export function isRecoverable(s: WalkSession, now: number): boolean {
  return now - s.savedAt <= WALK_SESSION_TTL_MS && s.path.length > 0
}

export function saveWalkSession(s: WalkSession): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // 용량 초과 등은 조용히 무시 — 복구는 부가 기능이므로 산책 자체를 막지 않는다.
  }
}

// 유효하고 복구 가능한 세션만 반환. 손상·만료된 값은 정리하고 null 을 돌려준다.
export function loadWalkSession(now: number): WalkSession | null {
  if (typeof window === 'undefined') return null
  let raw: string | null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearWalkSession()
    return null
  }
  if (!isValidSession(parsed) || !isRecoverable(parsed, now)) {
    clearWalkSession()
    return null
  }
  return parsed
}

export function clearWalkSession(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // 무시
  }
}
