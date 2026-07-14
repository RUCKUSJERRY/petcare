import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calcPetAge,
  daysUntil,
  ddayBadge,
  elapsedBadge,
  addMonths,
  careDefaultIntervalMonths,
  guideMatchScore,
  pickTopGuide,
  pickBestPerActivityType,
  timeAgo,
  cn,
  haversineMeters,
  pathDistanceMeters,
  formatDistance,
  formatDuration,
  formatPace,
  formatWon,
  nextAnniversary,
  daysTogether,
  todayKST,
  shiftDateTime,
  isoToLocalTime,
  localDateTimeToIso,
} from './utils'

describe('shiftDateTime', () => {
  it('분 단위로 시각을 이동한다', () => {
    expect(shiftDateTime('2026-06-30', '19:33', 1)).toEqual({ date: '2026-06-30', time: '19:34' })
    expect(shiftDateTime('2026-06-30', '19:33', -10)).toEqual({ date: '2026-06-30', time: '19:23' })
    expect(shiftDateTime('2026-06-30', '19:33', 60)).toEqual({ date: '2026-06-30', time: '20:33' })
  })
  it('자정을 넘으면 날짜로 올림/내림한다', () => {
    expect(shiftDateTime('2026-06-30', '23:50', 20)).toEqual({ date: '2026-07-01', time: '00:10' })
    expect(shiftDateTime('2026-06-30', '00:10', -20)).toEqual({ date: '2026-06-29', time: '23:50' })
  })
  it('월·연 경계도 올바르게 넘어간다', () => {
    expect(shiftDateTime('2026-12-31', '23:00', 120)).toEqual({ date: '2027-01-01', time: '01:00' })
  })
})

describe('isoToLocalTime / localDateTimeToIso', () => {
  it('로컬 날짜·시각 ↔ ISO 왕복이 일관된다', () => {
    const iso = localDateTimeToIso('2026-06-30', '19:33')
    expect(isoToLocalTime(iso)).toBe('19:33')
  })
  it('빈 값/잘못된 값은 null', () => {
    expect(isoToLocalTime(null)).toBeNull()
    expect(isoToLocalTime('')).toBeNull()
    expect(isoToLocalTime('not-a-date')).toBeNull()
  })
})

describe('calcPetAge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-09T00:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('개월/연 계산과 표시 텍스트', () => {
    expect(calcPetAge(2026, 1).months).toBe(5) // 2026-01 → 5개월
    expect(calcPetAge(2026, 1).displayText).toBe('5개월')
    expect(calcPetAge(2024, 6).displayText).toBe('2살')
    expect(calcPetAge(2023, 3).displayText).toBe('3살 3개월')
  })

  it('미래 생년월은 0개월로 클램프', () => {
    expect(calcPetAge(2027, 1).months).toBe(0)
  })

  it('강아지 생애 단계: 퍼피<12, 성견<84, 시니어>=84', () => {
    expect(calcPetAge(2026, 1, 'dog').lifeStage).toBe('퍼피')   // 5m
    expect(calcPetAge(2023, 6, 'dog').lifeStage).toBe('성견')   // 36m
    expect(calcPetAge(2016, 6, 'dog').lifeStage).toBe('시니어') // 120m
  })

  it('고양이 생애 단계: 키튼<12, 성묘<120, 시니어>=120', () => {
    expect(calcPetAge(2026, 1, 'cat').lifeStage).toBe('키튼')
    expect(calcPetAge(2024, 1, 'cat').lifeStage).toBe('성묘')   // 29m
    expect(calcPetAge(2010, 1, 'cat').lifeStage).toBe('시니어')
  })
})

describe('daysUntil / ddayBadge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-09T10:30:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('오늘/내일/지난 날짜', () => {
    expect(daysUntil('2026-06-09')).toBe(0)
    expect(daysUntil('2026-06-10')).toBe(1)
    expect(daysUntil('2026-06-12')).toBe(3)
    expect(daysUntil('2026-06-08')).toBe(-1)
  })

  it('기준일(todayStr)을 넘기면 시스템 시간 대신 그 날짜로 계산', () => {
    expect(daysUntil('2026-06-20', '2026-06-20')).toBe(0)
    expect(daysUntil('2026-06-21', '2026-06-20')).toBe(1)
    expect(daysUntil('2026-06-19', '2026-06-20')).toBe(-1)
    expect(ddayBadge('2026-06-20', '2026-06-20')).toEqual({ text: 'D-day', tone: 'today' })
    expect(ddayBadge('2026-06-22', '2026-06-20')).toEqual({ text: 'D-2', tone: 'soon' })
  })

  it('배지 텍스트와 톤', () => {
    expect(ddayBadge('2026-06-09')).toEqual({ text: 'D-day', tone: 'today' })
    expect(ddayBadge('2026-06-10')).toEqual({ text: 'D-1', tone: 'soon' })
    expect(ddayBadge('2026-06-20')).toEqual({ text: 'D-11', tone: 'upcoming' })
    expect(ddayBadge('2026-06-07')).toEqual({ text: '2일 지남', tone: 'overdue' })
  })
})

describe('elapsedBadge', () => {
  const today = '2026-06-09'

  it('마지막 시행으로부터 경과일을 텍스트로, 톤은 예정일 긴급도로', () => {
    // 마지막 5/10 시행(30일 경과), 다음 예정 6/09(오늘=지남 임박) → 텍스트=경과일, 톤=예정 긴급도
    expect(elapsedBadge('2026-05-10', '2026-06-09', today)).toEqual({ text: '30일 경과', tone: 'today' })
    expect(elapsedBadge('2026-05-10', '2026-06-12', today)).toEqual({ text: '30일 경과', tone: 'soon' })
    expect(elapsedBadge('2026-05-10', '2026-06-30', today)).toEqual({ text: '30일 경과', tone: 'upcoming' })
    // 예정일이 지났으면 톤은 overdue, 텍스트는 여전히 경과일
    expect(elapsedBadge('2026-05-10', '2026-06-07', today)).toEqual({ text: '30일 경과', tone: 'overdue' })
  })

  it('오늘 시행했으면 "오늘 시행"', () => {
    expect(elapsedBadge('2026-06-09', '2026-07-09', today).text).toBe('오늘 시행')
  })

  it('시행 이력(lastOn)이 없으면 예정일 D-day 배지로 폴백', () => {
    expect(elapsedBadge(null, '2026-06-10', today)).toEqual({ text: 'D-1', tone: 'soon' })
    expect(elapsedBadge(undefined, null, today)).toEqual({ text: '', tone: 'upcoming' })
  })
})

describe('todayKST', () => {
  afterEach(() => vi.useRealTimers())
  it('UTC와 무관하게 KST(+9) 달력 날짜를 반환', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T20:00:00Z')) // KST 2026-06-21 05:00
    expect(todayKST()).toBe('2026-06-21')
    vi.setSystemTime(new Date('2026-06-20T10:00:00Z')) // KST 2026-06-20 19:00
    expect(todayKST()).toBe('2026-06-20')
  })
})

describe('formatWon', () => {
  it('천단위 구분 + 원', () => {
    expect(formatWon(12000)).toBe('12,000원')
    expect(formatWon(0)).toBe('0원')
  })
  it('null/NaN 은 빈 문자열', () => {
    expect(formatWon(null)).toBe('')
    expect(formatWon(undefined)).toBe('')
    expect(formatWon(NaN)).toBe('')
  })
})

describe('nextAnniversary / daysTogether', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-09T10:30:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('아직 안 지난 올해 생일', () => {
    expect(nextAnniversary(6, 20)).toBe('2026-06-20')
  })
  it('이미 지난 생일 → 내년', () => {
    expect(nextAnniversary(1, 5)).toBe('2027-01-05')
  })
  it('오늘이 생일이면 오늘(D-day)', () => {
    expect(nextAnniversary(6, 9)).toBe('2026-06-09')
  })
  it('2/29 는 평년이면 2/28 로 보정', () => {
    expect(nextAnniversary(2, 29)).toBe('2027-02-28') // 2027 평년
  })
  it('일(day)이 없으면 null', () => {
    expect(nextAnniversary(6, null)).toBeNull()
  })

  it('함께한 일수 — 입양 당일 1일째', () => {
    expect(daysTogether('2026-06-09')).toBe(1)
    expect(daysTogether('2026-06-08')).toBe(2)
    expect(daysTogether('2026-05-30')).toBe(11)
  })
  it('미래/없음은 null', () => {
    expect(daysTogether('2026-06-10')).toBeNull()
    expect(daysTogether(null)).toBeNull()
  })
})

describe('addMonths', () => {
  it('개월 더하기 + 연도 넘김', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15')
    expect(addMonths('2026-12-10', 1)).toBe('2027-01-10')
    expect(addMonths('2026-06-09', 12)).toBe('2027-06-09')
  })
  it('월말은 대상 달 말일로 클램핑 (오버플로우로 한 달 건너뛰지 않음)', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')   // Feb 31 → 2/28 (평년)
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')   // 윤년 2/29
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30')   // Apr 31 → 4/30
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28')   // 6개월 후 2월
    expect(addMonths('2026-01-30', 1)).toBe('2026-02-28')   // 30일도 클램핑
  })
})

describe('careDefaultIntervalMonths', () => {
  it('카테고리별 권장 주기', () => {
    expect(careDefaultIntervalMonths('심장사상충')).toBe(1)
    expect(careDefaultIntervalMonths('구충')).toBe(3)
    expect(careDefaultIntervalMonths('접종')).toBe(12)
    expect(careDefaultIntervalMonths('기타')).toBeNull()
    expect(careDefaultIntervalMonths('알수없음')).toBeNull()
  })
})

describe('guideMatchScore / pickTopGuide', () => {
  it('우선순위 점수: 견종3 > 크기2 > 공통1 > 비해당0', () => {
    expect(guideMatchScore({ breed_id: 'b1', size_category: null }, 'b1', '소형')).toBe(3)
    expect(guideMatchScore({ breed_id: null, size_category: '소형' }, 'b1', '소형')).toBe(2)
    expect(guideMatchScore({ breed_id: null, size_category: null }, 'b1', '소형')).toBe(1)
    expect(guideMatchScore({ breed_id: 'other', size_category: null }, 'b1', '소형')).toBe(0)
  })

  it('pickTopGuide는 최고 점수 1건, 없으면 null', () => {
    const guides = [
      { id: 'common', breed_id: null, size_category: null },
      { id: 'size', breed_id: null, size_category: '소형' },
      { id: 'breed', breed_id: 'b1', size_category: null },
    ]
    expect(pickTopGuide(guides, 'b1', '소형')?.id).toBe('breed')
    expect(pickTopGuide([], 'b1', '소형')).toBeNull()
    expect(pickTopGuide([{ id: 'x', breed_id: 'other', size_category: null }], 'b1', '소형')).toBeNull()
  })
})

describe('pickBestPerActivityType', () => {
  it('활동 유형별 최고 우선순위 1건', () => {
    const guides = [
      { id: 'walk-common', breed_id: null, size_category: null, activity_type: '산책' },
      { id: 'walk-breed', breed_id: 'b1', size_category: null, activity_type: '산책' },
      { id: 'play-common', breed_id: null, size_category: null, activity_type: '놀이' },
    ]
    const m = pickBestPerActivityType(guides, 'b1', '소형')
    expect(m.get('산책')?.id).toBe('walk-breed')
    expect(m.get('놀이')?.id).toBe('play-common')
    expect(m.size).toBe(2)
  })
})

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-09T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('상대 시간', () => {
    expect(timeAgo(new Date('2026-06-09T11:59:30').toISOString())).toBe('방금 전')
    expect(timeAgo(new Date('2026-06-09T11:30:00').toISOString())).toBe('30분 전')
    expect(timeAgo(new Date('2026-06-09T09:00:00').toISOString())).toBe('3시간 전')
    expect(timeAgo(new Date('2026-06-07T12:00:00').toISOString())).toBe('2일 전')
  })
})

describe('cn', () => {
  it('falsy 제거 후 공백 결합', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
    expect(cn()).toBe('')
  })
})

describe('산책 거리/포맷 헬퍼', () => {
  it('haversineMeters: 위도 1도 ≈ 111km', () => {
    const d = haversineMeters({ lat: 37, lng: 127 }, { lat: 38, lng: 127 })
    expect(d).toBeGreaterThan(110000)
    expect(d).toBeLessThan(112000)
  })

  it('haversineMeters: 같은 좌표는 0', () => {
    expect(haversineMeters({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 })).toBe(0)
  })

  it('pathDistanceMeters: 누적 거리, 1점 이하는 0', () => {
    expect(pathDistanceMeters([])).toBe(0)
    expect(pathDistanceMeters([[37, 127]])).toBe(0)
    const total = pathDistanceMeters([[37, 127], [37.001, 127], [37.002, 127]])
    expect(total).toBeGreaterThan(200)
    expect(total).toBeLessThan(240)
  })

  it('formatDistance: m / km 표기', () => {
    expect(formatDistance(0)).toBe('0m')
    expect(formatDistance(850)).toBe('850m')
    expect(formatDistance(1234)).toBe('1.23km')
  })

  it('formatDuration: 시:분:초 / 분:초', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3725)).toBe('1:02:05')
  })

  it('formatPace: 거리 짧으면 "-", 아니면 분초/km', () => {
    expect(formatPace(5, 100)).toBe('-')
    expect(formatPace(1000, 360)).toBe("6'00\"/km")
    // 초 반올림이 분 경계를 넘어가도 5'60" 같은 잘못된 값이 나오지 않아야 한다.
    // 1000m / 359.6s → 359.6초/km → 6'00"/km (5'60" 아님)
    expect(formatPace(1000, 359.6)).toBe("6'00\"/km")
    expect(formatPace(1000, 89.6)).toBe("1'30\"/km")
  })
})
