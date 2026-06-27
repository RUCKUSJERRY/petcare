import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

const sections = [
  { href: '/foods', icon: '🥩', titleKey: 'foods', descKey: 'foodsDesc', accent: 'bg-red-50' },
  { href: '/health', icon: '🏥', titleKey: 'health', descKey: 'healthDesc', accent: 'bg-blue-50' },
  { href: '/walk', icon: '🎾', titleKey: 'walk', descKey: 'walkDesc', accent: 'bg-green-50' },
  { href: '/care', icon: '🧼', titleKey: 'care', descKey: 'careDesc', accent: 'bg-amber-50' },
] as const

export default async function InfoPage() {
  const t = await getTranslations('info')
  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('subtitle')}
        </p>
      </div>

      <div className="space-y-3">
        {sections.map(s => (
          <Link key={s.href} href={s.href} className="block">
            <div className="card flex items-center gap-4 active:scale-[0.99] transition-transform">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${s.accent}`}>
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{t(s.titleKey)}</div>
                <div className="text-sm text-gray-500 mt-0.5">{t(s.descKey)}</div>
              </div>
              <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
