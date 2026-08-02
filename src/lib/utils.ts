import type { PetAge, Species } from '@/types'

/**
 * 생년월로부터 현재 개월 수, 나이 단계 등을 계산
 */
export function calcPetAge(
  birthYear: number | null | undefined,
  birthMonth: number | null | undefined,
  species: Species = 'dog',
): PetAge {
  // 생년 미상(구조·임보) — 나이·생애단계를 성체 기준으로 일반화해 나이 기반 콘텐츠(가이드·급여량)가
  // '퍼피/키튼'으로 오인되지 않게 한다. 화면에는 unknown 플래그로 '미상'을 표시한다.
  if (birthYear == null) {
    return {
      months: 36, years: 3, displayText: '나이 미상',
      lifeStage: species === 'cat' ? '성묘' : '성견', unknown: true,
    }
  }
  // 생년월·기록 날짜가 모두 KST 달력 기준이므로, 서버(UTC)·해외 시간대에서 렌더해도
  // "오늘"이 흔들리지 않도록 KST 기준 연/월로 계산한다. (월 미상이면 1월로 간주)
  const [nowYear, nowMonth] = todayKST().split('-').map(Number)
  const totalMonths =
    (nowYear - birthYear) * 12 + (nowMonth - (birthMonth ?? 1))

  const months = Math.max(0, totalMonths)
  const years = Math.floor(months / 12)
  const remainMonths = months % 12

  const displayText =
    years === 0
      ? `${months}개월`
      : remainMonths === 0
      ? `${years}살`
      : `${years}살 ${remainMonths}개월`

  const lifeStage: PetAge['lifeStage'] = species === 'cat'
    ? (months < 12 ? '키튼' : months < 120 ? '성묘' : '시니어')
    : (months < 12 ? '퍼피' : months < 84 ? '성견' : '시니어')

  return { months, years, displayText, lifeStage, unknown: false }
}

/** 생애단계 배지 라벨 — 나이 미상이면 '미상'. */
export function stageLabel(age: PetAge): PetAge['lifeStage'] | '미상' {
  return age.unknown ? '미상' : age.lifeStage
}

/** 금액(원) 표기 — "12,000원". null/undefined·NaN 은 빈 문자열. */
export function formatWon(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return ''
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

/**
 * (월, 일) 기준 "다음 생일/기념일" 날짜 문자열(YYYY-MM-DD)을 반환.
 * 오늘이 그 날이면 오늘을 반환(D-day). 이미 지났으면 내년.
 * 2/29 처럼 올해 없는 날은 그 달의 마지막 날(2/28)로 보정.
 * day 가 없으면(null) 정확한 날을 알 수 없어 null 반환.
 */
export function nextAnniversary(month: number | null | undefined, day: number | null | undefined): string | null {
  if (!month || !day) return null
  const today = todayKST()
  const nowYear = Number(today.slice(0, 4))
  const clampDay = (y: number) => {
    const last = new Date(Date.UTC(y, month, 0)).getUTCDate() // 해당 월의 마지막 날
    return Math.min(day, last)
  }
  for (let y = nowYear; y <= nowYear + 1; y++) {
    const candStr = new Date(Date.UTC(y, month - 1, clampDay(y))).toISOString().slice(0, 10)
    if (daysUntil(candStr, today) >= 0) return candStr
  }
  return null
}

/**
 * 입양일(YYYY-MM-DD) 기준 "함께한 일수" — 입양 당일을 1일째로 센다.
 * 미래 날짜거나 형식이 잘못되면 null.
 */
export function daysTogether(adoptedOn: string | null | undefined): number | null {
  if (!adoptedOn) return null
  const elapsed = -daysUntil(adoptedOn, todayKST()) // 과거일수록 양수
  if (elapsed < 0) return null
  return elapsed + 1
}

/**
 * 함께한 날 기준 다가오는 100일 단위 이정표(100·200·300…일).
 * "곧 100일" 같은 정서적 재방문 계기를 주기 위해, withinDays 이내로 다가온 이정표만 반환한다.
 * dday=0 이면 오늘이 그 이정표. 이정표가 멀면 null(배지 미노출).
 */
export function togetherMilestone(
  together: number | null | undefined,
  withinDays = 14,
): { milestone: number; dday: number } | null {
  if (together == null || together < 1) return null
  const next = Math.ceil(together / 100) * 100
  const dday = next - together // 0=오늘, 양수=남은 일수
  if (dday < 0 || dday > withinDays) return null
  return { milestone: next, dday }
}

/**
 * 생활기록 '연속 기록일(streak)'을 계산한다.
 * 하루에 한 건이라도 기록이 있으면 그 날은 '기록한 날'로 친다.
 *
 * - 오늘 기록이 있으면 오늘부터, 없으면 어제부터 거슬러 올라가며 연속으로 기록한 날 수를 센다.
 *   (자정이 지나 아직 오늘 기록 전이어도 어제까지의 연속을 유지 — 하루의 유예를 준다.)
 * - 오늘도 어제도 기록이 없으면 연속이 끊긴 것으로 보고 0.
 * - Date.now()·타임존에 의존하지 않도록 '오늘'(KST YYYY-MM-DD)을 인자로 받아 결정적으로 계산한다.
 *
 * @param dates '기록한 날'의 날짜 문자열(YYYY-MM-DD) 집합 또는 반복가능 객체(중복·순서 무관)
 * @param today 기준 '오늘' (KST YYYY-MM-DD)
 */
export function computeLogStreak(dates: Iterable<string>, today: string): number {
  const set = dates instanceof Set ? dates : new Set(dates)
  if (set.size === 0) return 0
  // 연속의 시작점: 오늘 기록이 있으면 오늘, 없으면 어제(유예). 둘 다 없으면 끊김.
  let cursor = set.has(today) ? today : addDays(today, -1)
  if (!set.has(cursor)) return 0
  let streak = 0
  while (set.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

/**
 * 나이 단계별 색상 클래스 (Tailwind)
 */
export function lifeStageColor(stage: PetAge['lifeStage'] | '미상'): string {
  return ({
    퍼피: 'bg-amber-100 text-amber-800',
    키튼: 'bg-amber-100 text-amber-800',
    성견: 'bg-primary-100 text-primary-800',
    성묘: 'bg-primary-100 text-primary-800',
    시니어: 'bg-purple-100 text-purple-800',
  } as Record<string, string>)[stage] ?? 'bg-gray-100 text-gray-700'
}

/**
 * 음식 안전 등급 색상
 */
export function safetyColor(level: 'safe' | 'caution' | 'dangerous'): string {
  return {
    safe: 'bg-green-100 text-green-800',
    caution: 'bg-yellow-100 text-yellow-800',
    dangerous: 'bg-red-100 text-red-800',
  }[level]
}

export function safetyLabel(level: 'safe' | 'caution' | 'dangerous'): string {
  return { safe: '안전', caution: '주의', dangerous: '위험' }[level]
}

/**
 * cn 유틸 - tailwind 클래스 병합
 */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * 상대 시간 표시 ("방금 전", "3시간 전", "2일 전", 그 이상은 날짜)
 *
 * `now` 를 주입할 수 있게 열어 둔다 — 클라이언트 하이드레이션 시 서버 HTML(그때의 Date.now())과
 * 첫 렌더가 어긋나 하이드레이션 불일치가 나던 문제를, 호출부(TimeAgo)에서 시점을 고정해 없앤다.
 */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '방금 전'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

/**
 * 가이드(건강/산책) 적용범위 우선순위 점수.
 * 견종별(3) > 크기별(2) > 공통(1) > 비해당(0)
 */
export function guideMatchScore(
  guide: { breed_id: string | null; size_category: string | null },
  breedId: string,
  sizeCategory: string | null
): number {
  if (guide.breed_id === breedId) return 3
  if (guide.size_category && guide.size_category === sizeCategory) return 2
  if (!guide.breed_id && !guide.size_category) return 1
  return 0
}

/**
 * 후보 가이드 중 우선순위가 가장 높은 1건 선택 (없으면 null).
 */
export function pickTopGuide<T extends { breed_id: string | null; size_category: string | null }>(
  guides: T[],
  breedId: string,
  sizeCategory: string | null
): T | null {
  let best: T | null = null
  let bestScore = 0
  for (const g of guides) {
    const s = guideMatchScore(g, breedId, sizeCategory)
    if (s > bestScore) {
      best = g
      bestScore = s
    }
  }
  return best
}

/**
 * activity_type 별로 가장 우선순위 높은 가이드 1건씩 반환
 */
export function pickBestPerActivityType<
  T extends { breed_id: string | null; size_category: string | null; activity_type: string }
>(guides: T[], breedId: string, sizeCategory: string | null): Map<string, T> {
  const result = new Map<string, T>()
  for (const g of guides) {
    const score = guideMatchScore(g, breedId, sizeCategory)
    const current = result.get(g.activity_type)
    if (!current || score > guideMatchScore(current, breedId, sizeCategory)) {
      result.set(g.activity_type, g)
    }
  }
  return result
}

/**
 * 오늘 기준 D-day 계산. (날짜 문자열 YYYY-MM-DD)
 * 음수 = 지남, 0 = 오늘, 양수 = 남은 일수
 */
export function daysUntil(dateStr: string, todayStr?: string): number {
  // todayStr(YYYY-MM-DD)가 주어지면 그 날짜를 "오늘"로 사용한다.
  // (서버 cron은 실행 환경이 UTC라 KST 기준 오늘을 명시적으로 넘겨 시차 오차를 막는다.)
  const today = todayStr ? new Date(todayStr + 'T00:00:00') : new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

/** D-day 배지 텍스트와 톤 */
export function ddayBadge(dateStr: string, todayStr?: string): {
  text: string
  tone: 'overdue' | 'today' | 'soon' | 'upcoming'
} {
  const d = daysUntil(dateStr, todayStr)
  if (d < 0) return { text: `${Math.abs(d)}일 지남`, tone: 'overdue' }
  if (d === 0) return { text: 'D-day', tone: 'today' }
  if (d <= 7) return { text: `D-${d}`, tone: 'soon' }
  return { text: `D-${d}`, tone: 'upcoming' }
}

/**
 * '경과일' 중심 배지 — 건강 케어는 D-day 카운트다운보다 "마지막 시행으로부터 며칠 지났는지"가
 * 더 직관적이라(예: 심장사상충 먹인 지 32일) 이 배지를 우선 표시한다.
 * 텍스트는 경과일, 색상 톤은 예정일(dueOn)의 긴급도(지남/임박/여유)로 정한다.
 * 시행 이력(lastOn)이 없으면 예정일 D-day 배지로 폴백한다.
 */
export function elapsedBadge(lastOn: string | null | undefined, dueOn: string | null | undefined, todayStr?: string): {
  text: string
  tone: 'overdue' | 'today' | 'soon' | 'upcoming'
} {
  const tone = dueOn ? ddayBadge(dueOn, todayStr).tone : 'upcoming'
  if (!lastOn) return dueOn ? ddayBadge(dueOn, todayStr) : { text: '', tone }
  const since = Math.max(0, -daysUntil(lastOn, todayStr))
  return { text: since === 0 ? '오늘 시행' : `${since}일 경과`, tone }
}

/** D-day 톤별 색상 클래스 */
export function ddayToneClass(tone: 'overdue' | 'today' | 'soon' | 'upcoming'): string {
  return {
    overdue:  'bg-red-100 text-red-700',
    today:    'bg-red-100 text-red-700',
    soon:     'bg-amber-100 text-amber-700',
    upcoming: 'bg-gray-100 text-gray-500',
  }[tone]
}

/** 오늘 날짜를 KST(Asia/Seoul) 기준 YYYY-MM-DD 로 반환.
 *  기록 날짜(event_on·next_due_on 등)가 모두 KST 달력 기준이라,
 *  서버(UTC)·클라이언트 어디서 호출해도 "오늘"이 일관되게 계산된다. */
export function todayKST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/** ISO 타임스탬프(timestamptz)를 KST 달력 날짜 'YYYY-MM-DD' 로 변환.
 *  (산책 started_at 등 절대시각을 기록의 event_on 과 같은 KST 날짜 기준으로 맞출 때 사용) */
export function isoToKstDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso))
}

/** 날짜 문자열(YYYY-MM-DD)에 개월 수를 더해 반환 (시간대 영향 없이 UTC 기준 계산).
 *  월말 클램핑: 1/31 + 1개월은 2/31→3/3 으로 튀지 않고 2/28(윤년 2/29)로 맞춘다.
 *  (day 29~31 이 더 짧은 달에 떨어질 때 한 달을 건너뛰는 오버플로우 방지 — toss.addOneMonth 와 동일 규칙) */
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m + months, 0)).getUTCDate() // 대상 달의 말일
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10)
}

/** 날짜 문자열(YYYY-MM-DD)에 일수를 더해 반환 (시간대 영향 없이 UTC 기준) */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * 'YYYY-MM-DD' 날짜와 'HH:MM' 시각을 deltaMinutes 만큼 이동한 결과를 반환.
 * 분이 0~59 / 시가 0~23 범위를 넘으면 날짜로 올림·내림한다
 * (예: 00:10 에서 -20분 → 전날 23:50, 23:50 에서 +20분 → 다음날 00:10).
 * 로컬 달력 기준(기록의 event_at 표시·저장과 동일한 기준).
 */
export function shiftDateTime(
  dateStr: string, timeStr: string, deltaMinutes: number,
): { date: string; time: string } {
  const [y, mo, da] = dateStr.split('-').map(Number)
  const [h, mi] = timeStr.split(':').map(Number)
  const d = new Date(y, mo - 1, da, h, mi + deltaMinutes, 0, 0)
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  }
}

/** ISO 타임스탬프 → 로컬 'HH:MM' (없으면 null). */
export function isoToLocalTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 로컬 'YYYY-MM-DD' + 'HH:MM' → ISO 타임스탬프(UTC) 문자열. */
export function localDateTimeToIso(dateStr: string, timeStr: string): string {
  const [y, mo, da] = dateStr.split('-').map(Number)
  const [h, mi] = timeStr.split(':').map(Number)
  return new Date(y, mo - 1, da, h, mi, 0, 0).toISOString()
}

/** 현재 시각을 로컬 'HH:MM' 으로 반환. */
export function nowLocalTime(): string {
  const d = new Date()
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 건강 관리 카테고리별 권장 재시행 주기(개월). null = 권장 주기 없음 */
export function careDefaultIntervalMonths(category: string): number | null {
  return ({
    접종: 12,
    심장사상충: 1,
    구충: 3,
    외부기생충: 1,
    건강검진: 12,
    기타: null,
  } as Record<string, number | null>)[category] ?? null
}

/**
 * 관리 카테고리별 권장 재시행 주기(일).
 * 미용·양치·발톱 등 생활 관리까지 포함해 "일" 단위로 통일. null = 권장 주기 없음.
 */
export function careRecommendedCycleDays(category: string): number | null {
  return ({
    접종: 365,
    심장사상충: 30,
    구충: 90,
    외부기생충: 30,
    건강검진: 365,
    양치: 1,
    발톱: 28,
    미용: 56,
    목욕: 28,
    귀청소: 21,
    기타: null,
  } as Record<string, number | null>)[category] ?? null
}

/** 건강 관리 카테고리별 아이콘 */
export function careCategoryIcon(category: string): string {
  return {
    접종:       '💉',
    심장사상충: '🪱',
    구충:       '🐛',
    외부기생충: '🦟',
    건강검진:   '🩺',
    미용:       '✂️',
    양치:       '🪥',
    발톱:       '💅',
    목욕:       '🛁',
    귀청소:     '👂',
    진료:       '🏥',
    식사:       '🍚',
    간식:       '🦴',
    물:         '🥤',
    배변:       '🚽',
    투약:       '💊',
    기타:       '📋',
    소변:       '💧',
    대변:       '💩',
    증상:       '🤒',
  }[category] ?? '📋'
}

// ─── 산책 기록 ──────────────────────────────────────────────

/** 두 좌표 사이 거리(미터) — 하버사인 공식 */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000 // 지구 반지름(m)
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 경로 좌표 배열의 총 거리(미터) */
export function pathDistanceMeters(path: [number, number][]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += haversineMeters(
      { lat: path[i - 1][0], lng: path[i - 1][1] },
      { lat: path[i][0], lng: path[i][1] }
    )
  }
  return total
}

/** 거리(m) → "1.234km" / "850m" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(2)}km`
}

/** 소요 시간(초) → "1:23:45" 또는 "23:45" */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** 평균 페이스 "분'초"/km" (거리 0이면 '-') */
export function formatPace(meters: number, totalSec: number): string {
  if (meters < 10) return '-'
  const secPerKm = totalSec / (meters / 1000)
  // 초를 먼저 반올림한 뒤 분/초로 분해한다. (분·초를 따로 계산하면 초가 59.6→60 으로
  // 올림될 때 5'60"/km 같은 잘못된 값이 나온다 — 총초 기준으로 캐리를 정확히 처리)
  const totalRounded = Math.round(secPerKm)
  const m = Math.floor(totalRounded / 60)
  const s = totalRounded % 60
  return `${m}'${String(s).padStart(2, '0')}"/km`
}

/**
 * 커뮤니티 카테고리 색상
 */
export function categoryColor(category: string): string {
  return {
    질문: 'bg-blue-100 text-blue-700',
    자랑: 'bg-pink-100 text-pink-700',
    정보공유: 'bg-primary-100 text-primary-700',
    일상: 'bg-amber-100 text-amber-700',
  }[category] ?? 'bg-gray-100 text-gray-700'
}
