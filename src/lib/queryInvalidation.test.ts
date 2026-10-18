import { describe, it, expect } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
import { invalidateRecordCaches, invalidateWalkCaches } from './queryInvalidation'

/** 호출된 queryKey 들만 모으는 가짜 QueryClient. invalidateQueries 외엔 쓰지 않는다. */
function fakeQc() {
  const keys: unknown[][] = []
  const qc = {
    invalidateQueries: ({ queryKey }: { queryKey: unknown[] }) => { keys.push(queryKey) },
  } as unknown as QueryClient
  return { qc, keys }
}

describe('invalidateRecordCaches', () => {
  it('아이 지정 시 공용 기록 캐시(오늘/피드/예정/생활패턴/주간/월간)를 모두 무효화한다', () => {
    const { qc, keys } = fakeQc()
    invalidateRecordCaches(qc, 'p1')
    expect(keys).toEqual([
      ['today-timeline', null],
      ['record-feed', null],
      ['care-schedule'],
      ['today-log', 'p1'],
      ['today-timeline', 'p1'],
      ['record-feed', 'p1'],
      ['life-pattern', 'p1'],
      ['weekly-report', 'p1'],
      ['monthly-recap', 'p1'],
    ])
  })

  it('petId 가 null 이면 전체 아이(null) 스코프 + 전역 예정만 무효화한다', () => {
    const { qc, keys } = fakeQc()
    invalidateRecordCaches(qc, null)
    expect(keys).toEqual([
      ['today-timeline', null],
      ['record-feed', null],
      ['care-schedule'],
    ])
  })

  it('산책 전용 키(today-walk)는 기록 무효화에 포함하지 않는다(기록은 산책 수를 바꾸지 않음)', () => {
    const { qc, keys } = fakeQc()
    invalidateRecordCaches(qc, 'p1')
    expect(keys).not.toContainEqual(['today-walk', 'p1'])
  })
})

describe('invalidateWalkCaches', () => {
  it('아이 지정 시 산책 저장·삭제·수동 세 경로가 공유하는 전체 집합을 무효화한다', () => {
    const { qc, keys } = fakeQc()
    invalidateWalkCaches(qc, 'p1')
    expect(keys).toEqual([
      ['walks'],
      ['walk-goal'],
      ['today-walk', 'p1'],
      ['weekly-report', 'p1'],
      ['monthly-recap', 'p1'],
      ['pet-care-points', 'p1'],
    ])
  })

  it('petId 가 null 이면 목록·목표 등 전역 키만 무효화한다', () => {
    const { qc, keys } = fakeQc()
    invalidateWalkCaches(qc, null)
    expect(keys).toEqual([
      ['walks'],
      ['walk-goal'],
    ])
  })
})
