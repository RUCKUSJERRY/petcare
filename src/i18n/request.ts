import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { defaultLocale, LOCALE_COOKIE, locales, type Locale } from './config'

// URL 라우팅 없이(=경로 변경 없이) 쿠키 기반으로 로케일을 결정한다.
// 쿠키가 없거나 미지원 로케일이면 기본 로케일(ko)로 폴백.
export default getRequestConfig(async () => {
  const store = await cookies()
  const cookieLocale = store.get(LOCALE_COOKIE)?.value
  const locale: Locale = (locales as readonly string[]).includes(cookieLocale ?? '')
    ? (cookieLocale as Locale)
    : defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
