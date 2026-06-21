import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { updateLanguage } from '../api'
import { translations, type Lang, type TranslationKey } from './translations'

interface I18nContextValue {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  lang: Lang
  setLang: (lang: Lang) => Promise<void>
}

const I18nContext = createContext<I18nContextValue>(null!)

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return Object.entries(vars).reduce((acc, [key, value]) => acc.replace(`{${key}}`, String(value)), template)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth()
  const lang = (user?.language ?? localStorage.getItem('lang') ?? 'en') as Lang

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = (key: TranslationKey, vars?: Record<string, string | number>): string => {
    const dict = translations[lang]
    const template = dict[key] ?? translations.ru[key] ?? key
    return interpolate(template, vars)
  }

  const setLang = async (next: Lang) => {
    localStorage.setItem('lang', next)
    const updated = await updateLanguage(next)
    setUser(updated)
  }

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => useContext(I18nContext)
