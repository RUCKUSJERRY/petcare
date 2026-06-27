// 지원 로케일 정의. 지금은 한국어만 사용하지만, 여기에 'en' 등을 추가하고
// messages/<locale>.json 을 만들면 즉시 다국어로 확장된다.
export const locales = ['ko'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'ko'

// 로케일을 저장하는 쿠키 이름 (추후 언어 전환 토글에서 이 쿠키를 설정)
export const LOCALE_COOKIE = 'NEXT_LOCALE'
