import type { Pet } from '@/types'

/** 기념일 종류 — 생일 / 입양(가족이 된 날) 기념일 */
export type AnniversaryKind = 'birthday' | 'adoption'

export interface AnniversaryEvent {
  kind: AnniversaryKind
  /**
   * 생일: 알 수 있으면 만 나이(년), 모르면 null.
   * 입양: 함께한 해(주년) — 1 이상. (오늘이 입양 당일인 '0주년'은 기념일로 보지 않는다.)
   */
  years: number | null
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * (month, day) 기념일이 todayStr(YYYY-MM-DD) 당일인지 판정.
 * - 2/29 처럼 그 해에 없는 날은 그 달의 마지막 날(비윤년 2/28)로 보정해 매년 챙긴다.
 *   (nextAnniversary 의 clampDay 규칙과 동일 — 앱 배지와 푸시가 같은 날 발동)
 * - 문자열을 직접 조립해 비교하므로 실행 환경 시간대(UTC cron 등)에 영향받지 않는다.
 */
function occursToday(month: number, day: number, todayStr: string): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const year = Number(todayStr.slice(0, 4))
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate() // 해당 월의 말일
  const clampedDay = Math.min(day, lastDay)
  return `${year}-${pad(month)}-${pad(clampedDay)}` === todayStr
}

/**
 * 오늘(todayStr, KST 기준) 축하할 이 아이의 기념일 목록.
 * - 생일: birth_month + birth_day 가 모두 있을 때만 (일 미상이면 정확한 날을 알 수 없어 제외).
 * - 입양 기념일: adopted_on(YYYY-MM-DD)의 월·일이 오늘과 같고, 만 1주년 이상일 때만.
 * 순수 함수(부수효과 없음) — 홈 배지 로직과 별개로 푸시 cron 이 재사용한다.
 */
export function anniversariesToday(
  pet: Pick<Pet, 'birth_year' | 'birth_month' | 'birth_day' | 'adopted_on'>,
  todayStr: string,
): AnniversaryEvent[] {
  const events: AnniversaryEvent[] = []
  const todayYear = Number(todayStr.slice(0, 4))

  // 생일
  if (pet.birth_month && pet.birth_day && occursToday(pet.birth_month, pet.birth_day, todayStr)) {
    const years = pet.birth_year ? todayYear - pet.birth_year : null
    // 태어난 해에 이미 등록된 미래연도 등 비정상값 방지 — 음수면 나이 미표기
    events.push({ kind: 'birthday', years: years != null && years >= 0 ? years : null })
  }

  // 입양(가족이 된 날) 기념일 — YYYY-MM-DD 형식일 때만
  if (pet.adopted_on && /^\d{4}-\d{2}-\d{2}$/.test(pet.adopted_on)) {
    const [ay, am, ad] = pet.adopted_on.split('-').map(Number)
    if (occursToday(am, ad, todayStr)) {
      const years = todayYear - ay
      if (years >= 1) events.push({ kind: 'adoption', years })
    }
  }

  return events
}

/** 푸시 문구 생성용 — 오늘 축하할 (아이 이름 + 기념일) 한 건 */
export interface AnniversaryPushItem {
  name: string
  kind: AnniversaryKind
  years: number | null
}

/**
 * 오늘 축하 대상들을 사용자 1명에게 보낼 푸시 1건(title/body)으로 합친다.
 * - 대상이 없으면 null (발송하지 않음).
 * - 한 건이면 그 기념일에 맞춘 구체 문구, 여러 건이면 하나로 묶은 축하 문구.
 * 순수 함수(문구는 KST 한국어 고정 — 다른 푸시 라우트와 동일 방식).
 */
export function formatAnniversaryPush(
  items: AnniversaryPushItem[],
): { title: string; body: string } | null {
  if (items.length === 0) return null

  const phrase = (it: AnniversaryPushItem) =>
    it.kind === 'birthday'
      ? it.years != null
        ? `${it.name} ${it.years}번째 생일 🎂`
        : `${it.name} 생일 🎂`
      : `${it.name} 입양 ${it.years}주년 🏡`

  if (items.length === 1) {
    const it = items[0]
    if (it.kind === 'birthday') {
      return {
        title: `🎂 오늘은 ${it.name}의 생일이에요!`,
        body: it.years != null
          ? `${it.name}의 ${it.years}번째 생일을 축하해요. 오늘은 특별한 하루 보내세요 🎉`
          : `${it.name}의 생일을 축하해요. 오늘은 특별한 하루 보내세요 🎉`,
      }
    }
    return {
      title: `🏡 오늘은 ${it.name}와 함께한 지 ${it.years}주년!`,
      body: `${it.name}가 가족이 된 지 ${it.years}년이 되었어요. 그동안의 추억을 돌아볼까요? 💛`,
    }
  }

  return {
    title: '🎉 오늘은 특별한 날이에요!',
    body: `${items.map(phrase).join(', ')} — 우리 아이들의 기념일을 함께 축하해요.`,
  }
}
