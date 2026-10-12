import { cookies, headers } from 'next/headers'
import { LOCALE_COOKIE, pickLocale, type Locale } from './config'

/** Bahasa untuk request ini (server component, layout, metadata). */
export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  return pickLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerStore.get('accept-language'))
}
