// 반복 일정 규칙 엔진 (구글 캘린더형)
// records.recur_rule(text)에 JSON 직렬화로 저장한다. 단일·자기완결적 값이라 JSON 적합.
//
// 지원: 매일/N일, 매주(요일 선택)/N주, 매월 N일(dom)·매월 N째주 요일(dow), 매년

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=일 … 6=토
export type WeekOrdinal = 1 | 2 | 3 | 4 | 5 | -1 // -1=마지막

export type RecurRule =
  | { freq: 'day'; interval: number }
  | { freq: 'week'; interval: number; byweekday: Weekday[] }
  | { freq: 'month'; interval: number; mode: 'dom' }
  | { freq: 'month'; interval: number; mode: 'dow'; week: WeekOrdinal; weekday: Weekday }
  | { freq: 'year'; interval: number }

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
export const WEEK_ORDINAL_LABELS: Record<string, string> = { '1': '첫째', '2': '둘째', '3': '셋째', '4': '넷째', '5': '다섯째', '-1': '마지막' }

const DAY = 86400000

export function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}
function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - x.getDay())
  return x
}
function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

export function serializeRule(r: RecurRule): string {
  return JSON.stringify(r)
}
export function parseRule(s: string | null | undefined): RecurRule | null {
  if (!s) return null
  try {
    const r = JSON.parse(s)
    if (!r || typeof r !== 'object') return null
    if (typeof r.freq !== 'string' || typeof r.interval !== 'number') return null
    // interval 은 1 이상이어야 한다. 0/음수/NaN 이면 matches 의 나머지 연산이 NaN 이 되어
    // 어떤 날짜에도 매칭되지 않고, nextOccurrence 가 상한까지 헛돌다 null → 일정이 사라진다.
    if (!Number.isFinite(r.interval) || r.interval < 1) return null
    // 주간 규칙은 요일이 하나 이상 선택돼야 유효하다(빈 배열이면 영구히 매칭 안 됨).
    if (r.freq === 'week' && (!Array.isArray(r.byweekday) || r.byweekday.length === 0)) return null
    return r as RecurRule
  } catch { /* noop */ }
  return null
}

/** d가 그 달의 'week'번째 'weekday'인지 (week=-1: 마지막) */
function isNthWeekday(d: Date, week: WeekOrdinal, weekday: Weekday): boolean {
  if (d.getDay() !== weekday) return false
  if (week === -1) return d.getDate() + 7 > daysInMonth(d)
  const idx = Math.floor((d.getDate() - 1) / 7) + 1
  return idx === week
}

function matches(rule: RecurRule, base: Date, d: Date): boolean {
  if (d < base) return false
  switch (rule.freq) {
    case 'day': {
      const diff = Math.round((d.getTime() - base.getTime()) / DAY)
      return diff % rule.interval === 0
    }
    case 'week': {
      if (!rule.byweekday.includes(d.getDay() as Weekday)) return false
      const w = Math.round((startOfWeek(d).getTime() - startOfWeek(base).getTime()) / (DAY * 7))
      return w % rule.interval === 0
    }
    case 'month': {
      if (monthsBetween(base, d) % rule.interval !== 0) return false
      if (rule.mode === 'dom') {
        const target = Math.min(base.getDate(), daysInMonth(d))
        return d.getDate() === target
      }
      return isNthWeekday(d, rule.week, rule.weekday)
    }
    case 'year': {
      if ((d.getFullYear() - base.getFullYear()) % rule.interval !== 0) return false
      const target = Math.min(base.getDate(), daysInMonth(d))
      return d.getMonth() === base.getMonth() && d.getDate() === target
    }
  }
}

/** base(시작일) 기준, after 이후(미포함)의 첫 발생일.
 *  탐색 상한은 규칙 주기를 두 번 덮을 만큼 동적으로 잡는다 — 고정 800일이면
 *  '3년마다'(≈1096일)·긴 간격 월간 규칙의 다음 발생일이 상한을 넘겨 null 로 사라졌다. */
export function nextOccurrence(rule: RecurRule, base: Date, after: Date): Date | null {
  const d = new Date(Math.max(after.getTime(), base.getTime() - DAY))
  const span =
    rule.freq === 'year' ? 366 * (rule.interval * 2 + 1)
    : rule.freq === 'month' ? 31 * (rule.interval * 2 + 2)
    : rule.freq === 'week' ? 7 * (rule.interval * 2) + 14
    : rule.interval * 2 + 2
  const maxDays = Math.max(800, span)
  for (let i = 0; i < maxDays; i++) {
    d.setDate(d.getDate() + 1)
    if (matches(rule, base, d)) return new Date(d)
  }
  return null
}

/**
 * 화면·정렬에 쓸 "다음 예정일".
 * 반복이면 today(포함) 이후의 다음 발생일로 굴려서 항상 미래 일정을 보여준다.
 * 반복이 아니면 저장된 next_due를 그대로 쓴다(미내원 예정일이 지나면 '지남'으로 표시).
 */
export function activeNextDue(eventOn: string, recurRule: string | null, storedNextDue: string | null, today: string): string | null {
  const rule = parseRule(recurRule)
  if (rule) {
    const before = parseYMD(today)
    before.setDate(before.getDate() - 1) // today 포함
    const next = nextOccurrence(rule, parseYMD(eventOn), before)
    return next ? ymd(next) : storedNextDue
  }
  return storedNextDue
}

/** 사람이 읽는 규칙 설명 (base = 시작일, dom/year의 '일' 표시에 사용) */
export function describeRule(rule: RecurRule | null, baseYmd: string): string {
  if (!rule) return ''
  const base = parseYMD(baseYmd)
  const n = rule.interval
  switch (rule.freq) {
    case 'day':
      return n === 1 ? '매일' : `${n}일마다`
    case 'week': {
      const days = rule.byweekday.slice().sort().map(w => WEEKDAY_LABELS[w]).join('·')
      const head = n === 1 ? '매주' : `${n}주마다`
      return days ? `${head} ${days}` : head
    }
    case 'month': {
      const head = n === 1 ? '매월' : `${n}개월마다`
      if (rule.mode === 'dom') return `${head} ${base.getDate()}일`
      return `${head} ${WEEK_ORDINAL_LABELS[String(rule.week)]} 주 ${WEEKDAY_LABELS[rule.weekday]}요일`
    }
    case 'year':
      return n === 1 ? `매년 ${base.getMonth() + 1}월 ${base.getDate()}일` : `${n}년마다 ${base.getMonth() + 1}월 ${base.getDate()}일`
  }
}
