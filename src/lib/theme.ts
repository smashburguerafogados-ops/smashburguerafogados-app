import { createContext, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export const THEME_IDS = ['atual', 'natal', 'ano-novo', 'carnaval', 'pascoa', 'sao-joao'] as const

export type ThemeId = (typeof THEME_IDS)[number]

export const THEME_LABEL: Record<ThemeId, string> = {
  atual: 'Atual',
  natal: 'Natal',
  'ano-novo': 'Ano Novo',
  carnaval: 'Carnaval',
  pascoa: 'Páscoa',
  'sao-joao': 'São João',
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)
}

export function readTheme(data: Record<string, unknown> | undefined): ThemeId {
  return isThemeId(data?.theme) ? data.theme : 'atual'
}

export function watchTheme(onNext: (theme: ThemeId) => void, onError: () => void): () => void {
  return onSnapshot(
    doc(db, 'settings', 'theme'),
    (snapshot) => {
      onNext(readTheme(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined))
    },
    () => onError(),
  )
}

export async function saveTheme(theme: ThemeId): Promise<void> {
  await setDoc(doc(db, 'settings', 'theme'), { theme }, { merge: true })
}

export const ThemeContext = createContext<ThemeId>('atual')

export function useTheme(): ThemeId {
  return useContext(ThemeContext)
}

export function applyDocumentTheme(theme: ThemeId | null) {
  if (theme == null) {
    delete document.documentElement.dataset.theme
    return
  }
  document.documentElement.dataset.theme = theme
}

export function useAppliedTheme(): ThemeId {
  const [theme, setTheme] = useState<ThemeId>('atual')

  useEffect(
    () =>
      watchTheme(
        (next) => setTheme(next),
        () => setTheme('atual'),
      ),
    [],
  )

  return theme
}
