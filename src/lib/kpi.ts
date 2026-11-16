/**
 * 관리자 KPI 중 '온보딩 퍼널'과 '가입 주차 코호트 잔존'을 계산하는 순수 로직.
 *
 * 상용화 단기 체크리스트(docs/commercialization-roadmap.md 9장)의 두 항목을 채운다.
 *  - 4주 잔존(cohort): 가입 후 N주차에 다시 기록했는가
 *  - 온보딩 첫 경험 측정: 가입 > 아이 등록 > 첫 기록 > 다른 날 재기록 중 어디서 빠지는가
 *
 * 활동 신호는 기존 리텐션 지표와 같은 '기록 작성(records.created_at)' 이며, records 에 작성자
 * 컬럼이 없어 반려동물 소유자(pets.user_id)에게 귀속한다. 공동 관리 구성원의 기록도 소유자
 * 활동으로 잡히는 한계가 있다(구성원 본인은 '아이 등록' 단계만 통과로 본다).
 *
 * Date.now() 에 의존하지 않도록 기준 시각(nowMs)을 인자로 받아 결정적으로 계산한다.
 */

export interface KpiUser { id: string; created_at: string }
/** 소유 또는 공동 관리 중인 아이가 있다는 사실(사용자 id 목록) */
export type KpiPetHolders = Iterable<string>
/** 기록 1건 = 소유자 id + 작성 시각 */
export interface KpiActivity { user_id: string; created_at: string }

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
// KST 달력 날짜 키(재기록 '다른 날' 판정용). Intl 대신 고정 오프셋으로 빠르게 계산.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const kstDay = (ms: number) => Math.floor((ms + KST_OFFSET_MS) / DAY_MS)

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)

function groupActivity(acts: KpiActivity[]): Map<string, number[]> {
  const byUser = new Map<string, number[]>()
  for (const a of acts) {
    const t = Date.parse(a.created_at)
    if (!Number.isFinite(t)) continue
    let arr = byUser.get(a.user_id)
    if (!arr) { arr = []; byUser.set(a.user_id, arr) }
    arr.push(t)
  }
  return byUser
}

export interface OnboardingFunnel {
  windowDays: number
  signups: number
  withPet: number
  firstRecord: number
  /** 첫 기록과 다른 KST 날짜에 한 번 더 기록 = 습관 형성의 첫 신호 */
  secondDay: number
  /** 각 단계의 가입자 대비 비율(%) */
  rates: { withPet: number; firstRecord: number; secondDay: number }
  /** 첫 기록까지 걸린 시간(가입 기준) 중앙값(시간). 첫 기록자가 없으면 null */
  medianHoursToFirstRecord: number | null
}

/**
 * 최근 windowDays 일 가입자의 온보딩 퍼널.
 * acts 는 해당 가입자들의 가입 이후 기록을 빠짐없이 담고 있어야 한다(호출부가 창을 맞춤).
 */
export function computeOnboardingFunnel(
  users: KpiUser[],
  petHolders: KpiPetHolders,
  acts: KpiActivity[],
  nowMs: number,
  windowDays = 30,
): OnboardingFunnel {
  const since = nowMs - windowDays * DAY_MS
  const cohort = users.filter(u => {
    const t = Date.parse(u.created_at)
    return Number.isFinite(t) && t >= since && t <= nowMs
  })
  const holders = new Set(petHolders)
  const byUser = groupActivity(acts)

  let withPet = 0, firstRecord = 0, secondDay = 0
  const hoursToFirst: number[] = []
  for (const u of cohort) {
    const signup = Date.parse(u.created_at)
    const times = (byUser.get(u.id) ?? []).filter(t => t >= signup && t <= nowMs)
    // 기록이 있으면 아이도 있다(기록은 아이에 달림). 아이 삭제 등으로 holders 에 없어도 통과로 본다.
    if (holders.has(u.id) || times.length > 0) withPet++
    if (times.length === 0) continue
    firstRecord++
    const first = Math.min(...times)
    hoursToFirst.push((first - signup) / (60 * 60 * 1000))
    const firstDay = kstDay(first)
    if (times.some(t => kstDay(t) !== firstDay)) secondDay++
  }

  return {
    windowDays,
    signups: cohort.length,
    withPet,
    firstRecord,
    secondDay,
    rates: {
      withPet: pct(withPet, cohort.length),
      firstRecord: pct(firstRecord, cohort.length),
      secondDay: pct(secondDay, cohort.length),
    },
    medianHoursToFirstRecord: median(hoursToFirst),
  }
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  const v = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
  return Math.round(v * 10) / 10
}

export interface CohortRow {
  /** 0 = 최근 7일 가입, 1 = 8~14일 전 가입 ... (기준 시각에서 거꾸로 센 주) */
  weeksAgo: number
  size: number
  /**
   * week[k] = 가입 후 k주차(가입 시각 기준 [7k, 7k+7)일)에 기록한 비율(%).
   * k=0 은 첫 주 활성화. 해당 주가 아직 끝나지 않은 사용자는 분모에서 빼고,
   * 끝난 사용자가 한 명도 없으면 null(아직 측정 불가).
   */
  week: (number | null)[]
}

/**
 * 가입 주차(기준 시각에서 7일 단위로 거슬러 센 구간) 코호트별 0~maxWeek 주차 잔존율.
 * acts 는 가장 오래된 코호트의 가입 이후 기록을 빠짐없이 담고 있어야 한다.
 */
export function computeCohortRetention(
  users: KpiUser[],
  acts: KpiActivity[],
  nowMs: number,
  cohorts = 6,
  maxWeek = 4,
): CohortRow[] {
  const byUser = groupActivity(acts)
  const rows: CohortRow[] = []
  for (let c = 0; c < cohorts; c++) {
    const end = nowMs - c * WEEK_MS
    const start = end - WEEK_MS
    const members = users.filter(u => {
      const t = Date.parse(u.created_at)
      return Number.isFinite(t) && t >= start && t < end
    })
    const week: (number | null)[] = []
    for (let k = 0; k <= maxWeek; k++) {
      let eligible = 0, retained = 0
      for (const u of members) {
        const signup = Date.parse(u.created_at)
        const wStart = signup + k * WEEK_MS
        const wEnd = wStart + WEEK_MS
        if (wEnd > nowMs) continue // 아직 끝나지 않은 주는 판정 보류
        eligible++
        if ((byUser.get(u.id) ?? []).some(t => t >= wStart && t < wEnd)) retained++
      }
      week.push(eligible > 0 ? pct(retained, eligible) : null)
    }
    rows.push({ weeksAgo: c, size: members.length, week })
  }
  return rows
}
