import { describe, it, expect, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOcrProviderOrderServer } from './settings'

// app_settings.ocr_provider 조회를 흉내내는 최소 목 클라이언트
// (.from('app_settings').select('value').eq('key', …).maybeSingle())
function clientReturning(value: string | null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: value == null ? null : { value } }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('getOcrProviderOrderServer', () => {
  const orig = process.env.OCR_PROVIDER
  afterEach(() => {
    if (orig === undefined) delete process.env.OCR_PROVIDER
    else process.env.OCR_PROVIDER = orig
  })

  it('관리자 설정(app_settings)이 최우선 — gemini', async () => {
    expect(await getOcrProviderOrderServer(clientReturning('gemini'))).toEqual(['gemini', 'upstage'])
  })

  it('관리자 설정 upstage → upstage 우선', async () => {
    expect(await getOcrProviderOrderServer(clientReturning('upstage'))).toEqual(['upstage', 'gemini'])
  })

  it('관리자 설정 없으면 env OCR_PROVIDER 로 폴백', async () => {
    process.env.OCR_PROVIDER = 'gemini'
    expect(await getOcrProviderOrderServer(clientReturning(null))).toEqual(['gemini', 'upstage'])
  })

  it('둘 다 없으면 기본값 upstage', async () => {
    delete process.env.OCR_PROVIDER
    expect(await getOcrProviderOrderServer(clientReturning(null))).toEqual(['upstage', 'gemini'])
  })

  it('알 수 없는 값은 기본(upstage 우선)으로 안전 폴백', async () => {
    delete process.env.OCR_PROVIDER
    expect(await getOcrProviderOrderServer(clientReturning('bogus'))).toEqual(['upstage', 'gemini'])
  })
})
