import type { ReactNode } from 'react'
import { ThemeContext, useAppliedTheme, type ThemeId } from '../lib/theme'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function ThemeIcon({ theme }: { theme: ThemeId }) {
  if (theme === 'natal') {
    return (
      <Icon>
        <path d="M12 3l2.1 5.8H20l-4.7 3.5 1.8 5.7L12 15.2 6.9 18l1.8-5.7L4 8.8h5.9z" fill="currentColor" />
      </Icon>
    )
  }
  if (theme === 'ano-novo') {
    return (
      <Icon>
        <path d="M12 2l1.2 4.2L17 7.2l-3.2 2.2.8 4.4L12 11.6 9.4 13.8l.8-4.4L7 7.2l3.8-1z" fill="currentColor" />
        <path d="M18 13l.6 2 2 .6-2 .6-.6 2-.6-2-2-.6 2-.6z" fill="currentColor" />
      </Icon>
    )
  }
  if (theme === 'carnaval') {
    return (
      <Icon>
        <path
          d="M4 10c2-4 6-4 8-1 2-3 6-3 8 1-1 2-2 4-4 5-1.2.6-2.5.4-4-.6-1.5 1-2.8 1.2-4 .6-2-1-3-3-4-5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="9" cy="11" r="1" fill="currentColor" />
        <circle cx="15" cy="11" r="1" fill="currentColor" />
      </Icon>
    )
  }
  if (theme === 'pascoa') {
    return (
      <Icon>
        <ellipse cx="12" cy="13" rx="6" ry="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 12h8M9 15h6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </Icon>
    )
  }
  if (theme === 'sao-joao') {
    return (
      <Icon>
        <path d="M12 4c2 3 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4 3-7z" fill="currentColor" />
        <path d="M6 20h12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </Icon>
    )
  }
  return null
}

export function ThemeFrame({ children }: { children: ReactNode }) {
  const theme = useAppliedTheme()
  return (
    <ThemeContext.Provider value={theme}>
      <ThemeMark theme={theme} />
      {children}
    </ThemeContext.Provider>
  )
}

export function ThemeMark({ theme }: { theme: ThemeId }) {
  if (theme === 'atual') return null
  return (
    <div className="theme-mark" data-theme-ornament={theme} aria-hidden="true">
      <ThemeIcon theme={theme} />
    </div>
  )
}
