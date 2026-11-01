/**
 * '추억 다시보기(그날의 오늘)' 순수 선택 로직.
 *
 * 과거에 남긴 기록/산책 중 '오늘과 같은 날짜'(지난 해들의 같은 월/일, 또는 올해 안에서 같은
 * 날짜의 지난 달들)를 골라, 홈에서 "N년 전 오늘" / "N개월 전 오늘" 로 다시 꺼내 보여준다.
 * 사진/메모가 있는 정서적인 기록을 되살려 재방문/체류 동기를 더하는 리텐션 카드용.
 *
 * Date.now()·Math.random() 미사용(문자열·UTC 조립만) — 결정적이라 서버/클라이언트 동일 재현·
 * 테스트가 가능하고, 실행 환경 시간대(UTC cron 등)에 영향받지 않는다. 표시 문구는 숫자
 * (yearsAgo/monthsAgo)만 돌려주고 컴포넌트가 i18n(ko.json)으로 조립한다(monthlyRecap 방침).
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** 해당 연·월(1~12)의 말일. */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export interface MemorySource {
  id: string
  kind: 'record' | 'walk'
  /** KST 날짜 'YYYY-MM-DD' (기록은 event_on, 산책은 started_at 의 KST 날짜) */
  dateStr: string
  /** 표시용 제목 (기록 카테고리/제목, 산책 제목) */
  title: string
  /** 기록 카테고리 (아이콘용, 산책이면 생략) */
  category?: string
  memo?: string | null
  placeName?: string | null
  photoUrl?: string | null
}

export interface Memory extends MemorySource {
  /** 같은 월/일 기준 몇 해 전인지(1 이상이면 'N년 전 오늘'). 연 단위로 안 떨어지면 0. */
  yearsAgo: number
  /** 같은 일(day-of-month) 기준 몇 개월 전인지(연으로 안 떨어질 때 'N개월 전 오늘'). 아니면 0. */
  monthsAgo: number
}

/**
 * dateStr 가 todayStr 기준 '그날의 오늘'인지 판정하고, 아니면 null.
 * - 같은 월/일이고 지난 해면 yearsAgo(>=1) 부여('N년 전 오늘').
 * - 연 단위로 안 떨어지지만 같은 '일'이고 지난 달이면 monthsAgo(>=1) 부여('N개월 전 오늘').
 *   (2/31 처럼 그 달에 없는 날로 클램핑되는 경우는 '같은 일'이 아니므로 제외 — 정확 일치만.)
 * - 둘 다 아니면 null(오늘·미래·관계없는 날).
 */
export function memoryAge(dateStr: string, todayStr: string): { yearsAgo: number; monthsAgo: number } | null {
  const [dy, dm, dd] = dateStr.split('-').map(Number)
  const [ty, tm, td] = todayStr.split('-').map(Number)
  if (!dy || !dm || !dd || !ty || !tm || !td) return null

  // N년 전 오늘 — 같은 월/일, 지난 해.
  if (dm === tm && dd === td && dy < ty) {
    return { yearsAgo: ty - dy, monthsAgo: 0 }
  }

  // N개월 전 오늘 — 같은 '일', 지난 달(올해 안이든 해 넘김이든 11개월 이내).
  // 같은 월/일이면 위에서 처리되므로 여기선 월이 다른 경우만 남는다.
  if (dd === td) {
    const months = (ty - dy) * 12 + (tm - dm)
    // 과거(1개월 이상)이고 12개월 미만(연 단위는 위 분기 몫)일 때만.
    if (months >= 1 && months < 12) {
      // 그 달에 '같은 일'이 실제로 존재했는지 확인(존재하지 않으면 애초에 그 날짜 기록이 없다).
      if (td <= lastDayOfMonth(dy, dm)) return { yearsAgo: 0, monthsAgo: months }
    }
  }

  return null
}

/**
 * records.event_on 조회(.in)에 쓸 '그날의 오늘' 후보 날짜들을 만든다.
 * - 지난 해들의 같은 월/일 (maxYears 까지, 그 해에 그 날짜가 실제 존재할 때만 — 2/29 등 클램프 제외)
 * - 지난 달들의 같은 '일' (maxMonths 까지, 그 달에 그 '일'이 존재할 때만)
 * 결과는 중복 없이 오름차순 정렬. (컴포넌트가 재판정하므로 과잉 후보여도 안전하다.)
 */
export function candidateMemoryDates(
  todayStr: string,
  { maxYears = 20, maxMonths = 11 }: { maxYears?: number; maxMonths?: number } = {},
): string[] {
  const [ty, tm, td] = todayStr.split('-').map(Number)
  if (!ty || !tm || !td) return []
  const out = new Set<string>()

  // 지난 해들의 같은 월/일 — 그 해 그 달에 그 '일'이 실제 존재할 때만(2/29 비윤년 등 제외).
  for (let k = 1; k <= maxYears; k++) {
    const y = ty - k
    if (td <= lastDayOfMonth(y, tm)) out.add(`${y}-${pad(tm)}-${pad(td)}`)
  }

  // 지난 달들의 같은 '일' — 그 달에 그 '일'이 존재할 때만(31일 없는 달 등 제외).
  for (let k = 1; k <= maxMonths; k++) {
    let y = ty
    let m = tm - k
    while (m <= 0) { m += 12; y -= 1 }
    if (td <= lastDayOfMonth(y, m)) out.add(`${y}-${pad(m)}-${pad(td)}`)
  }

  return Array.from(out).sort()
}

/**
 * 과거 기록/산책(sources) 중 '그날의 오늘'만 골라 라벨용 숫자를 붙이고 정렬해 상위 max 건 반환.
 * 정렬: 사진 있는 것 > 메모 있는 것 > 더 최근 날짜. (가장 정서적인 추억을 먼저 보여준다.)
 */
export function selectMemories(
  sources: MemorySource[],
  todayStr: string,
  { max = 6 }: { max?: number } = {},
): Memory[] {
  const memories: Memory[] = []
  for (const s of sources) {
    const age = memoryAge(s.dateStr, todayStr)
    if (age) memories.push({ ...s, yearsAgo: age.yearsAgo, monthsAgo: age.monthsAgo })
  }

  const score = (m: Memory) => (m.photoUrl ? 2 : 0) + (m.memo && m.memo.trim() ? 1 : 0)
  memories.sort((a, b) => {
    const s = score(b) - score(a)
    if (s !== 0) return s
    // 더 최근(오늘에 가까운) 추억을 먼저
    if (a.dateStr !== b.dateStr) return a.dateStr < b.dateStr ? 1 : -1
    return a.id < b.id ? -1 : 1
  })

  return memories.slice(0, max)
}
