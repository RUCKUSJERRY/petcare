/** 산책 통계 집계에 필요한 최소 형태 */
export interface WalkLike {
  started_at: string   // ISO timestamp
  distance_m: number
  duration_s: number
}

export interface WalkTotals {
  count: number
  distance_m: number
  duration_s: number
}

export interface WeekBucket {
  /** 주 시작일(월요일) YYYY-MM-DD */
  weekStart: string
  distance_m: number
  count: number
}

export interface WalkSummary {
  thisWeek: WalkTotals
  thisMonth: WalkTotals
  all: WalkTotals
  /** 최근 N주 추이 (오래된 주 → 최신 주). 막대그래프용 */
  weekly: WeekBucket[]
  /** weekly 중 최대 거리 (막대 정규화용) */
  maxWeekDistance: number
}

const DAY = 24 * 60 * 60 * 1000

/** 해당 시각이 속한 주의 월요일 00:00 (로컬 기준) */
function weekStartOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const dow = (x.getDay() + 6) % 7 // 월=0 ... 일=6
  x.setDate(x.getDate() - dow)
  return x
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const empty = (): WalkTotals => ({ count: 0, distance_m: 0, duration_s: 0 })

function add(acc: WalkTotals, w: WalkLike) {
  acc.count += 1
  acc.distance_m += w.distance_m || 0
  acc.duration_s += w.duration_s || 0
}

/**
 * 산책 목록을 이번 주/이번 달/전체 합계 + 최근 weeks주 추이로 집계한다.
 * @param now 기준 시각(기본 현재). 테스트용으로 주입 가능.
 */
export function summarizeWalks(walks: WalkLike[], now: Date = new Date(), weeks = 6): WalkSummary {
  const thisWeek = empty()
  const thisMonth = empty()
  const all = empty()

  const curWeekStart = weekStartOf(now)
  const curMonth = now.getFullYear() * 12 + now.getMonth()

  // 최근 weeks개 주 버킷 (월요일 시작) — 인덱스 0 = 가장 오래된 주
  const buckets: WeekBucket[] = []
  const startToIdx = new Map<string, number>()
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(curWeekStart.getTime() - i * 7 * DAY)
    const key = ymd(ws)
    startToIdx.set(key, buckets.length)
    buckets.push({ weekStart: key, distance_m: 0, count: 0 })
  }

  for (const w of walks) {
    const t = new Date(w.started_at)
    if (Number.isNaN(t.getTime())) continue
    add(all, w)

    if (ymd(weekStartOf(t)) === ymd(curWeekStart)) add(thisWeek, w)
    if (t.getFullYear() * 12 + t.getMonth() === curMonth) add(thisMonth, w)

    const idx = startToIdx.get(ymd(weekStartOf(t)))
    if (idx != null) {
      buckets[idx].distance_m += w.distance_m || 0
      buckets[idx].count += 1
    }
  }

  const maxWeekDistance = buckets.reduce((mx, b) => Math.max(mx, b.distance_m), 0)
  return { thisWeek, thisMonth, all, weekly: buckets, maxWeekDistance }
}
