import { describe, expect, it } from 'vitest'
import { computeUpcoming, latestRecordPerLine, scheduleLineKey, type ScheduleRow } from './schedule'

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
  it('반복 규칙이 있으면 마지막 시행일 다음 발생일을 예정으로 잡는다', () => {
    const rows: ScheduleRow[] = [
      {
        id: 'r1', pet_id: 'p1', category: '심장사상충', title: '하트가드',
        event_on: '2026-06-05', next_due_on: null,
        recur_rule: JSON.stringify({ freq: 'month', interval: 1, mode: 'dom' }),
      },
    ]
    const out = computeUpcoming(rows)
    expect(out).toHaveLength(1)
    expect(out[0].record_id).toBe('r1')
    expect(out[0].last_on).toBe('2026-06-05')
    expect(out[0].next_due_on).toBe('2026-07-05') // 매월 5일 → 6/5 다음은 7/5
  })

  it('저장된 next_due_on이 시행일과 어긋나 있어도 규칙으로 다시 계산한다', () => {
    // next_due_on='2026-06-05'(시행일과 동일)로 잘못 굳어 있어도, 마지막 시행일(6/5)의
    // 다음 발생일(7/5)을 규칙으로 재계산해 쓴다. (정적 stored 값에 의존하지 않음)
    const rows: ScheduleRow[] = [
      {
        id: 'r1', pet_id: 'p1', category: '심장사상충', title: '하트가드',
        event_on: '2026-06-05', next_due_on: '2026-06-05',
        recur_rule: JSON.stringify({ freq: 'month', interval: 1, mode: 'dom' }),
      },
    ]
    const out = computeUpcoming(rows)
    expect(out).toHaveLength(1)
    expect(out[0].next_due_on).toBe('2026-07-05') // 마지막 시행(6/5) 다음 발생일
  })

  it('예정일이 지났는데 새 기록이 없으면 다음 회차로 넘기지 않고 지난 예정으로 남긴다', () => {
    // 사용자 보고 시나리오: 6/16 복용·매월 반복, 오늘 7/17. 목록이 8/16으로 굴러 지난 예정(7/16)을
    // 숨기던 문제 → 이제 7/16(지남)으로 남겨 '지난 일정'에 노출된다(상세 화면과도 일치).
    const rows: ScheduleRow[] = [
      {
        id: 'r1', pet_id: 'p1', category: '심장사상충', title: '넥스가드',
        event_on: '2026-06-16', next_due_on: '2026-07-16',
        recur_rule: JSON.stringify({ freq: 'month', interval: 1, mode: 'dom' }),
      },
    ]
    const out = computeUpcoming(rows)
    expect(out[0].next_due_on).toBe('2026-07-16')
  })

  it('반복이 아니면 저장된 next_due_on을 그대로 쓰고, 없으면 제외', () => {
    const rows: ScheduleRow[] = [
      { id: 'a', pet_id: 'p1', category: '접종', title: '종합백신', event_on: '2026-06-01', next_due_on: '2027-06-01', recur_rule: null },
      { id: 'b', pet_id: 'p1', category: '진료', title: '외이염', event_on: '2026-06-10', next_due_on: null, recur_rule: null },
    ]
    const out = computeUpcoming(rows)
    expect(out).toHaveLength(1)
    expect(out[0].record_id).toBe('a')
    expect(out[0].next_due_on).toBe('2027-06-01')
  })

  it('같은 라인은 최신 기록만 반영한다', () => {
    const rows: ScheduleRow[] = [
      { id: 'new', pet_id: 'p1', category: '양치', title: '양치', event_on: '2026-06-30', next_due_on: '2026-07-30', recur_rule: null },
      { id: 'old', pet_id: 'p1', category: '양치', title: '양치', event_on: '2026-06-01', next_due_on: '2026-07-01', recur_rule: null },
    ]
    const out = computeUpcoming(rows)
    expect(out).toHaveLength(1)
    expect(out[0].record_id).toBe('new')
    expect(out[0].next_due_on).toBe('2026-07-30')
  })
})
