import { describe, it, expect } from 'vitest'
import { nextOccurrence, activeNextDue, describeRule, parseRule, parseYMD, ymd, occurrencesBetween, type RecurRule } from './recurrence'

const next = (rule: RecurRule, base: string, after: string) => {
  const d = nextOccurrence(rule, parseYMD(base), parseYMD(after))
  return d ? ymd(d) : null
}

describe('nextOccurrence', () => {
  it('N일마다', () => {
    expect(next({ freq: 'day', interval: 3 }, '2025-06-01', '2025-06-01')).toBe('2025-06-04')
  })
  it('매주 월·수', () => {
    const r: RecurRule = { freq: 'week', interval: 1, byweekday: [1, 3] }
    expect(next(r, '2025-06-02', '2025-06-02')).toBe('2025-06-04') // 다음 수요일
    expect(next(r, '2025-06-02', '2025-06-04')).toBe('2025-06-09') // 다음 월요일
  })
  it('매월 1일', () => {
    const r: RecurRule = { freq: 'month', interval: 1, mode: 'dom' }
    expect(next(r, '2025-01-01', '2025-01-15')).toBe('2025-02-01')
  })
  it('매월 첫째 주 월요일', () => {
    const r: RecurRule = { freq: 'month', interval: 1, mode: 'dow', week: 1, weekday: 1 }
    expect(next(r, '2025-06-01', '2025-06-01')).toBe('2025-06-02') // 6월 첫 월요일
    expect(next(r, '2025-06-01', '2025-06-02')).toBe('2025-07-07') // 7월 첫 월요일
  })
  it('매월 마지막 주 금요일', () => {
    const r: RecurRule = { freq: 'month', interval: 1, mode: 'dow', week: -1, weekday: 5 }
    expect(next(r, '2025-06-01', '2025-06-01')).toBe('2025-06-27') // 6월 마지막 금요일
  })
  it('매년', () => {
    const r: RecurRule = { freq: 'year', interval: 1 }
    expect(next(r, '2025-03-10', '2025-06-01')).toBe('2026-03-10')
  })
  it('3년마다 — 800일 상한을 넘는 다음 발생일도 놓치지 않는다', () => {
    // 회귀: 고정 800일 탐색이면 ≈1096일 뒤의 발생일이 null 로 사라졌다.
    const r: RecurRule = { freq: 'year', interval: 3 }
    expect(next(r, '2025-03-10', '2025-03-10')).toBe('2028-03-10')
  })
  it('간격이 큰 월간 규칙(24개월마다)도 다음 발생일을 찾는다', () => {
    const r: RecurRule = { freq: 'month', interval: 24, mode: 'dom' }
    expect(next(r, '2025-01-15', '2025-01-15')).toBe('2027-01-15')
  })
})

describe('parseRule (유효성)', () => {
  it('정상 규칙은 파싱된다', () => {
    expect(parseRule(JSON.stringify({ freq: 'day', interval: 2 }))).toEqual({ freq: 'day', interval: 2 })
  })
  it('interval<=0 은 거부 (일정이 영구히 사라지는 것 방지)', () => {
    expect(parseRule(JSON.stringify({ freq: 'day', interval: 0 }))).toBeNull()
    expect(parseRule(JSON.stringify({ freq: 'month', interval: -1, mode: 'dom' }))).toBeNull()
  })
  it('요일이 비어 있는 주간 규칙은 거부', () => {
    expect(parseRule(JSON.stringify({ freq: 'week', interval: 1, byweekday: [] }))).toBeNull()
  })
  it('지원하지 않는 freq 는 거부 (매칭 안 돼 일정이 사라지는 것 방지)', () => {
    // 구버전·손상된 데이터·잘못된 임포트로 알 수 없는 freq 가 들어와도 유효로 통과하면
    // matches 가 어떤 날짜에도 매칭되지 않아 예정 목록·리마인더에서 조용히 사라진다.
    expect(parseRule(JSON.stringify({ freq: 'hour', interval: 1 }))).toBeNull()
    expect(parseRule(JSON.stringify({ freq: '', interval: 1 }))).toBeNull()
    expect(parseRule(JSON.stringify({ freq: 'Daily', interval: 1 }))).toBeNull()
  })
  it('빈 값·깨진 JSON 은 null', () => {
    expect(parseRule(null)).toBeNull()
    expect(parseRule('not json')).toBeNull()
  })
  it('mode 누락·잘못된 월간 규칙은 거부 (어떤 날짜에도 매칭 안 돼 일정이 사라지는 것 방지)', () => {
    // mode 없음 → matches 가 dow 분기로 빠져 undefined week/weekday 로 영구 미매칭
    expect(parseRule(JSON.stringify({ freq: 'month', interval: 1 }))).toBeNull()
    expect(parseRule(JSON.stringify({ freq: 'month', interval: 1, mode: 'weird' }))).toBeNull()
    // dow 인데 week/weekday 가 유효 범위를 벗어남
    expect(parseRule(JSON.stringify({ freq: 'month', interval: 1, mode: 'dow', week: 0, weekday: 1 }))).toBeNull()
    expect(parseRule(JSON.stringify({ freq: 'month', interval: 1, mode: 'dow', week: 1, weekday: 7 }))).toBeNull()
  })
  it('정상 월간 규칙(dom·dow)은 파싱된다', () => {
    expect(parseRule(JSON.stringify({ freq: 'month', interval: 1, mode: 'dom' })))
      .toEqual({ freq: 'month', interval: 1, mode: 'dom' })
    expect(parseRule(JSON.stringify({ freq: 'month', interval: 2, mode: 'dow', week: -1, weekday: 5 })))
      .toEqual({ freq: 'month', interval: 2, mode: 'dow', week: -1, weekday: 5 })
  })
})

describe('occurrencesBetween', () => {
  const rule = (r: RecurRule) => JSON.stringify(r)
  it('매월 1일 — 구간 안의 모든 발생일을 편다 (미래 달도 채워짐)', () => {
    // 시작 1/1, 3~5월 구간이면 3/1·4/1·5/1 이 모두 나와야 한다.
    expect(occurrencesBetween(rule({ freq: 'month', interval: 1, mode: 'dom' }), '2025-01-01', '2025-03-01', '2025-05-31'))
      .toEqual(['2025-03-01', '2025-04-01', '2025-05-01'])
  })
  it('매주 월요일 — 한 달 창의 모든 월요일', () => {
    expect(occurrencesBetween(rule({ freq: 'week', interval: 1, byweekday: [1] }), '2025-06-02', '2025-06-01', '2025-06-30'))
      .toEqual(['2025-06-02', '2025-06-09', '2025-06-16', '2025-06-23', '2025-06-30'])
  })
  it('base 이전 구간은 발생 없음', () => {
    expect(occurrencesBetween(rule({ freq: 'day', interval: 1 }), '2025-06-10', '2025-06-01', '2025-06-05'))
      .toEqual([])
  })
  it('양끝(from·to)을 포함한다', () => {
    expect(occurrencesBetween(rule({ freq: 'day', interval: 5 }), '2025-06-01', '2025-06-06', '2025-06-16'))
      .toEqual(['2025-06-06', '2025-06-11', '2025-06-16'])
  })
  it('규칙이 없으면 빈 배열', () => {
    expect(occurrencesBetween(null, '2025-06-01', '2025-06-01', '2025-06-30')).toEqual([])
  })
})

describe('activeNextDue', () => {
  it('반복이면 마지막 시행일 다음 발생일 — today 로 굴리지 않는다', () => {
    const r = JSON.stringify({ freq: 'month', interval: 1, mode: 'dom' })
    // 시작 2025-01-01, 다음 발생은 2/1. 오늘이 3/10이라도 미래로 건너뛰지 않고
    // 2/1(지난 예정)로 남긴다 — 아직 하지 않은 케어를 'overdue'로 계속 노출하기 위함.
    expect(activeNextDue('2025-01-01', r, '2025-02-01')).toBe('2025-02-01')
  })
  it('예정일이 지나도 다음 회차로 넘어가지 않는다 (목록=상세 일치)', () => {
    const r = JSON.stringify({ freq: 'month', interval: 1, mode: 'dom' })
    // 6/16 복용·매월 반복. 오늘이 7/17이어도 다음 예정은 8/16이 아니라 7/16(지남)으로 표시.
    expect(activeNextDue('2026-06-16', r, '2026-07-16')).toBe('2026-07-16')
  })
  it('반복이 아니면 저장된 값을 그대로', () => {
    expect(activeNextDue('2025-01-01', null, '2025-02-01')).toBe('2025-02-01')
  })
})

describe('describeRule', () => {
  it('매월 1일', () => {
    expect(describeRule({ freq: 'month', interval: 1, mode: 'dom' }, '2025-06-01')).toBe('매월 1일')
  })
  it('매월 첫째 주 월요일', () => {
    expect(describeRule({ freq: 'month', interval: 1, mode: 'dow', week: 1, weekday: 1 }, '2025-06-02')).toBe('매월 첫째 주 월요일')
  })
  it('매주 월·수', () => {
    expect(describeRule({ freq: 'week', interval: 1, byweekday: [1, 3] }, '2025-06-02')).toBe('매주 월·수')
  })
})
