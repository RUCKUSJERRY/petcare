import { describe, expect, it } from 'vitest'
import { computeUpcoming, latestRecordPerLine, scheduleLineKey, type ScheduleRow } from './schedule'

const today = '2026-07-02'

describe('scheduleLineKey', () => {
  it('제품성 카테고리는 title까지 구분, 그 외는 아이·카테고리 단위', () => {
    expect(scheduleLineKey('p1', '접종', '종합백신')).toBe('p1|접종|종합백신')
    expect(scheduleLineKey('p1', '접종', '광견병')).toBe('p1|접종|광견병')
    expect(scheduleLineKey('p1', '양치', '양치')).toBe('p1|양치')
    // 비제품 카테고리는 title이 달라도 같은 라인
    expect(scheduleLineKey('p1', '양치', '아침 양치')).toBe('p1|양치')
  })
})

describe('latestRecordPerLine', () => {
  it('라인당 최신(먼저 오는) 행만 남긴다', () => {
    const rows = [
      { pet_id: 'p1', category: '양치' as const, title: '양치', event_on: '2026-06-20' },
      { pet_id: 'p1', category: '양치' as const, title: '양치', event_on: '2026-06-01' },
      { pet_id: 'p1', category: '접종' as const, title: '종합백신', event_on: '2026-05-01' },
      { pet_id: 'p1', category: '접종' as const, title: '광견병', event_on: '2026-05-02' },
    ]
    const out = latestRecordPerLine(rows)
    expect(out).toHaveLength(3) // 양치 1 + 접종(종합/광견병) 2
    expect(out.find(r => r.category === '양치')?.event_on).toBe('2026-06-20')
  })
})

describe('computeUpcoming', () => {
  it('반복 규칙이 있으면 오늘 이후 다음 예정일로 굴린다', () => {
    const rows: ScheduleRow[] = [
      {
        id: 'r1', pet_id: 'p1', category: '심장사상충', title: '하트가드',
        event_on: '2026-06-05', next_due_on: null,
        recur_rule: JSON.stringify({ freq: 'month', interval: 1, mode: 'dom' }),
      },
    ]
    const out = computeUpcoming(rows, today)
    expect(out).toHaveLength(1)
    expect(out[0].record_id).toBe('r1')
    expect(out[0].last_on).toBe('2026-06-05')
    expect(out[0].next_due_on).toBe('2026-07-05') // 매월 5일 → 오늘(7/2) 이후 다음은 7/5
  })

  it('반복 기록의 next_due_on이 과거로 굳어 있어도 활성 예정일로 굴린다 (리마인더 지속 발송의 근거)', () => {
    // 생성 시점에 next_due_on='2026-06-05'로 고정된 뒤 완료 탭을 안 해 과거로 남은 매월 반복.
    // 정적 next_due_on 범위 필터라면 두 번째 발생부터 빠지지만, computeUpcoming은 오늘 이후로 굴린다.
    const rows: ScheduleRow[] = [
      {
        id: 'r1', pet_id: 'p1', category: '심장사상충', title: '하트가드',
        event_on: '2026-06-05', next_due_on: '2026-06-05',
        recur_rule: JSON.stringify({ freq: 'month', interval: 1, mode: 'dom' }),
      },
    ]
    const out = computeUpcoming(rows, today)
    expect(out).toHaveLength(1)
    expect(out[0].next_due_on).toBe('2026-07-05') // 과거(6/5)가 아니라 오늘(7/2) 이후 다음 발생일
  })

  it('반복이 아니면 저장된 next_due_on을 그대로 쓰고, 없으면 제외', () => {
    const rows: ScheduleRow[] = [
      { id: 'a', pet_id: 'p1', category: '접종', title: '종합백신', event_on: '2026-06-01', next_due_on: '2027-06-01', recur_rule: null },
      { id: 'b', pet_id: 'p1', category: '진료', title: '외이염', event_on: '2026-06-10', next_due_on: null, recur_rule: null },
    ]
    const out = computeUpcoming(rows, today)
    expect(out).toHaveLength(1)
    expect(out[0].record_id).toBe('a')
    expect(out[0].next_due_on).toBe('2027-06-01')
  })

  it('같은 라인은 최신 기록만 반영한다', () => {
    const rows: ScheduleRow[] = [
      { id: 'new', pet_id: 'p1', category: '양치', title: '양치', event_on: '2026-06-30', next_due_on: '2026-07-30', recur_rule: null },
      { id: 'old', pet_id: 'p1', category: '양치', title: '양치', event_on: '2026-06-01', next_due_on: '2026-07-01', recur_rule: null },
    ]
    const out = computeUpcoming(rows, today)
    expect(out).toHaveLength(1)
    expect(out[0].record_id).toBe('new')
    expect(out[0].next_due_on).toBe('2026-07-30')
  })
})
