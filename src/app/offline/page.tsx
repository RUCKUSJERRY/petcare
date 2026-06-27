import { getTranslations } from 'next-intl/server'

export async function generateMetadata() {
  const t = await getTranslations('system')
  return { title: t('offlineMetaTitle') }
}

export default async function OfflinePage() {
  const t = await getTranslations('system')
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-50">
      <div className="text-5xl mb-4">📡</div>
      <h1 className="text-lg font-bold text-gray-900">{t('offlineTitle')}</h1>
      <p className="text-sm text-gray-500 mt-2">
        {t('offlineDesc')}
      </p>
    </div>
  )
}
