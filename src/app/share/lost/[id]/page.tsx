import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { createStaticClient } from '@/lib/supabase/static'
import { ShareButton } from '@/components/ui/ShareButton'
import type { LostPet } from '@/types'

export const dynamic = 'force-dynamic'

async function getLostPet(id: string): Promise<LostPet | null> {
  const sb = createStaticClient()
  const { data } = await sb
    .from('lost_pets')
    .select('*, breed:breeds(name_ko)')
    .eq('id', id)
    .maybeSingle()
  return (data ?? null) as unknown as LostPet | null
}

// 공유 링크 미리보기(카카오톡·SNS 등)용 Open Graph 메타데이터
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const pet = await getLostPet(params.id)
  const t = await getTranslations('lost')
  if (!pet) return { title: t('metaFallbackTitle') }
  const where = pet.area_text ? ` (${pet.area_text})` : ''
  const title = t('shareSearchingTitleMeta', { name: pet.name ?? t('unknownName'), where })
  const description = pet.description?.slice(0, 120) || t('metaDefaultDescription')
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: pet.photo_url ? [pet.photo_url] : undefined,
    },
  }
}

export default async function PublicLostPage({ params }: { params: { id: string } }) {
  const pet = await getLostPet(params.id)
  if (!pet) notFound()
  const t = await getTranslations('lost')

  const mapUrl = `https://map.kakao.com/link/map/실종위치,${pet.lat},${pet.lng}`

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>🐾</span>
          <span className="font-bold text-primary-700">{t('shareBrand')}</span>
        </div>

        {pet.status === 'found' && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm text-center font-medium">
            {t('shareFoundBanner')}
          </div>
        )}

        {pet.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pet.photo_url} alt="" className="w-full rounded-2xl object-cover max-h-80" />
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{pet.name ?? t('unknownName')}</h1>
            <span className="text-sm text-gray-400">{pet.species === 'cat' ? t('speciesCat') : t('speciesDog')}</span>
          </div>
          <p className="text-sm text-gray-500">
            {pet.breed?.name_ko ?? ''}{pet.gender ? ` · ${pet.gender}` : ''} · {t('lostDateLabel')} {pet.lost_at}
          </p>
          {pet.area_text && <p className="text-sm text-gray-500">📍 {pet.area_text}</p>}
        </div>

        {pet.description && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white border border-gray-100 rounded-xl p-3">
            {pet.description}
          </p>
        )}

        <a
          href={mapUrl}
          target="_blank"
          rel="noopener"
          className="block w-full text-center rounded-lg border border-gray-200 text-gray-700 py-2.5 text-sm font-medium hover:bg-gray-50"
        >
          {t('shareViewLocationOnMap')}
        </a>

        {pet.contact && pet.contact_public && pet.status === 'active' && (
          <a href={`tel:${pet.contact}`} className="btn-primary w-full py-3 block text-center">
            {t('shareContactOwner')} {pet.contact}
          </a>
        )}

        <ShareButton
          path={`/share/lost/${pet.id}`}
          title={t('shareSearchingTitle', { name: pet.name ?? t('unknownName') })}
          text={pet.area_text ? t('shareTextWithArea', { area: pet.area_text }) : t('shareTextNoArea')}
          label={t('shareSpreadWide')}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm"
        />

        <div className="pt-2 text-center">
          <Link href={`/lost/${pet.id}`} className="text-sm text-primary-600 font-semibold">
            {t('shareReportInApp')}
          </Link>
          <p className="text-xs text-gray-400 mt-1">{t('shareReportNote')}</p>
        </div>
      </div>
    </div>
  )
}
