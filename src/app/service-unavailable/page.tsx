import { getTranslations } from 'next-intl/server'

export async function generateMetadata() {
  const t = await getTranslations('system')
  return { title: t('unavailableMetaTitle') }
}

export default async function ServiceUnavailablePage() {
  const t = await getTranslations('system')
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">🐾</div>
        <h1 className="text-xl font-bold text-gray-900">
          {t('unavailableTitle')}
        </h1>
        <p className="text-gray-500 mt-3 text-sm leading-relaxed">
          {t('unavailableDesc1')}
          <br />
          {t('unavailableDesc2')}
        </p>
        <p className="text-gray-400 mt-2 text-xs">
          {t('unavailableNote')}
        </p>

        <a
          href="/"
          className="inline-block mt-8 px-6 py-3 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
        >
          {t('retry')}
        </a>
      </div>
    </div>
  )
}
