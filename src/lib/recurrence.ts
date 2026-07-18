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
    // freq 는 지원하는 4종(day/week/month/year)만 유효하다. 알 수 없는 값(구버전·손상된 데이터·
    // 잘못된 임포트)이 들어오면 matches 의 switch 가 어떤 case 에도 걸리지 않아 undefined 를 반환,
    // nextOccurrence 가 상한까지 헛돌다 null → 일정이 예정 목록·리마인더에서 사라진다
    // (interval/week/month 가드와 같은 취지의 마지막 미검증 필드).
    if (r.freq !== 'day' && r.freq !== 'week' && r.freq !== 'month' && r.freq !== 'year') return null
    // interval 은 1 이상이어야 한다. 0/음수/NaN 이면 matches 의 나머지 연산이 NaN 이 되어
    // 어떤 날짜에도 매칭되지 않고, nextOccurrence 가 상한까지 헛돌다 null → 일정이 사라진다.
    if (!Number.isFinite(r.interval) || r.interval < 1) return null
    // 주간 규칙은 요일이 하나 이상 선택돼야 유효하다(빈 배열이면 영구히 매칭 안 됨).
    if (r.freq === 'week' && (!Array.isArray(r.byweekday) || r.byweekday.length === 0)) return null
    // 월간 규칙은 mode 가 'dom' 이거나, 'dow' + 유효한 week(-1|1~5)·weekday(0~6) 여야 한다.
    // mode 누락·잘못된 dow 값이면 matches 가 어떤 날짜에도 매칭되지 않아 nextOccurrence 가
    // null 을 반환하고 일정이 예정 목록·리마인더에서 사라진다(week/interval 가드와 같은 취지).
    if (r.freq === 'month') {
      if (r.mode === 'dow') {
        if (![-1, 1, 2, 3, 4, 5].includes(r.week)) return null
        if (!Number.isInteger(r.weekday) || r.weekday < 0 || r.weekday > 6) return null
      } else if (r.mode !== 'dom') {
        return null
      }
    }
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
 * base(시작일) 기준, [fromYmd, toYmd] 구간(양끝 포함) 안의 모든 반복 발생일(YYYY-MM-DD).
 * 캘린더가 "보이는 달 범위"로 반복 일정을 펼쳐 그리는 데 쓴다 — 다음 1회만 찍혀
 * 미래 달이 텅 비어 보이던 문제를 없앤다. 규칙이 없으면 빈 배열.
 * (구간은 캘린더 6주=42일이라 일 단위 순회로 충분히 가볍다.)
 */
export function occurrencesBetween(
  recurRule: string | null | undefined,
  baseYmd: string,
  fromYmd: string,
  toYmd: string,
): string[] {
  const rule = parseRule(recurRule)
  if (!rule) return []
  const base = parseYMD(baseYmd)
  const to = parseYMD(toYmd)
  // base 이전은 발생하지 않으므로 시작점을 max(from, base) 로 잡는다.
  const d = new Date(Math.max(parseYMD(fromYmd).getTime(), base.getTime()))
  const out: string[] = []
  // 순회 상한(안전장치): 구간이 비정상적으로 넓어도 폭주하지 않게 한다.
  for (let guard = 0; d <= to && guard < 4000; guard++) {
    if (matches(rule, base, d)) out.push(ymd(new Date(d)))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/**
 * 화면·정렬에 쓸 "다음 예정일".
 * 반복이면 '마지막 시행일(eventOn)'의 다음 발생일을 쓴다. today 로 굴려 미래로 건너뛰지
 * 않는다 — 예정일이 지나도 다음 회차로 넘기지 않고 '지난 일정(overdue)'으로 남겨야, 아직
 * 하지 않은 케어(예: 심장사상충 복용)를 놓치지 않는다. 새 기록을 남기면 eventOn 이 최신으로
 * 옮겨가며 자연히 다음 회차로 진행된다. (이 값은 저장 시 계산해 두는 next_due_on·상세 화면의
 * 다음 예정일과 동일 — 목록/상세/저장값이 항상 일치한다.)
 * 반복이 아니면 저장된 next_due를 그대로 쓴다(예정일이 지나면 '지남'으로 표시).
 */
export function activeNextDue(eventOn: string, recurRule: string | null, storedNextDue: string | null): string | null {
  const rule = parseRule(recurRule)
  if (rule) {
    const base = parseYMD(eventOn)
    const next = nextOccurrence(rule, base, base)
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
