import type { PetAge, Species } from '@/types'

/**
 * 생년월로부터 현재 개월 수, 나이 단계 등을 계산
 */
export function calcPetAge(birthYear: number, birthMonth: number, species: Species = 'dog'): PetAge {
  // 생년월·기록 날짜가 모두 KST 달력 기준이므로, 서버(UTC)·해외 시간대에서 렌더해도
  // "오늘"이 흔들리지 않도록 KST 기준 연/월로 계산한다.
  const [nowYear, nowMonth] = todayKST().split('-').map(Number)
  const totalMonths =
    (nowYear - birthYear) * 12 + (nowMonth - birthMonth)

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

  return { months, years, displayText, lifeStage }
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
export function nextAnniversary(month: number, day: number | null | undefined): string | null {
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
 * 나이 단계별 색상 클래스 (Tailwind)
 */
export function lifeStageColor(stage: PetAge['lifeStage']): string {
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
 */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
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

/** 날짜 문자열(YYYY-MM-DD)에 개월 수를 더해 반환 (시간대 영향 없이 UTC 기준 계산) */
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10)
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
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
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
