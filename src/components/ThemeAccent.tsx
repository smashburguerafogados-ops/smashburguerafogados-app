import type { ReactNode } from 'react'
import { useTheme } from '../lib/theme'
import {
  ACCENT_LEVEL,
  THEME_ACCENTS,
  accentShown,
  accentTheme,
  type AccentPlace,
  type GarlandKind,
  type Hat,
} from '../lib/themeAccents'
import { themeIcons } from './ThemeIcons'

const HATS: Record<Exclude<Hat, 'mask'>, ReactNode> = {
  santa: (
    <svg viewBox="0 0 48 40">
      <path d="M7 31C8 14 21 4 36 9c-3 7 0 16 6 22Z" fill="#d62828" />
      <path d="M12 22c6-8 14-11 22-11" stroke="#f05252" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".7" />
      <rect x="3" y="28" width="43" height="9" rx="4.5" fill="#fff" />
      <circle cx="38" cy="8" r="5.5" fill="#fff" />
    </svg>
  ),
  party: (
    <svg viewBox="0 0 40 44">
      <path d="M20 5 36 38H4Z" fill="#E3B15A" />
      <path d="M13 22h14M9 31h22" stroke="#111" strokeWidth="3" />
      <path d="M20 5 36 38H20Z" fill="#c8942f" opacity=".5" />
      <circle cx="20" cy="5" r="4" fill="#fff" />
      <path d="M4 38h32" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  bunny: (
    <svg viewBox="0 0 48 44">
      <g transform="rotate(-14 16 36)">
        <ellipse cx="16" cy="18" rx="6" ry="16" fill="#fff" />
        <ellipse cx="16" cy="19" rx="3" ry="11" fill="#f6a5c0" />
      </g>
      <g transform="rotate(14 32 36)">
        <ellipse cx="32" cy="18" rx="6" ry="16" fill="#fff" />
        <ellipse cx="32" cy="19" rx="3" ry="11" fill="#f6a5c0" />
      </g>
    </svg>
  ),
  straw: (
    <svg viewBox="0 0 52 36">
      <ellipse cx="26" cy="27" rx="24" ry="7" fill="#e0b25a" />
      <path d="M12 26c0-14 6-20 14-20s14 6 14 20Z" fill="#f0c978" />
      <path d="M12 24h28" stroke="#d62828" strokeWidth="4" />
      <path d="M4 27h44" stroke="#b98a35" strokeWidth="1.5" opacity=".7" />
      <rect x="31" y="14" width="6" height="6" rx="1" fill="#009c3b" transform="rotate(8 34 17)" />
    </svg>
  ),
}

const SEGMENT = 40

function GarlandBulb({ kind, color, x }: { kind: GarlandKind; color: string; x: number }) {
  if (kind === 'lights') {
    return (
      <>
        <circle cx={x} cy="8.2" r="2.8" fill={color} />
        <circle cx={x} cy="8.2" r="5" fill={color} opacity=".22" />
      </>
    )
  }
  if (kind === 'eggs') {
    return (
      <>
        <ellipse cx={x} cy="9" rx="3" ry="4" fill={color} />
        <path d={`M${x - 3} 9h6`} stroke="#fff" strokeWidth=".8" opacity=".7" />
      </>
    )
  }
  return <path d={`M${x - 6} 6.6 L${x + 6} 6.6 L${x} 16Z`} fill={color} />
}

function Garland({ kind, colors }: { kind: GarlandKind; colors: string[] }) {
  const tile = SEGMENT * colors.length
  const wire = colors.map((_, i) => `${i === 0 ? `M0 2 ` : ''}Q${i * SEGMENT + SEGMENT / 2} 12 ${(i + 1) * SEGMENT} 2`).join(' ')
  return (
    <svg width="100%" height="16" aria-hidden="true">
      <defs>
        <pattern id="theme-garland" width={tile} height="18" patternUnits="userSpaceOnUse">
          <path d={wire} fill="none" stroke="#6b5a3a" strokeWidth="1" />
          {colors.map((color, i) => (
            <GarlandBulb key={i} kind={kind} color={color} x={i * SEGMENT + SEGMENT / 2} />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="18" fill="url(#theme-garland)" />
    </svg>
  )
}

type ThemeAccentProps = { place: AccentPlace; index?: number }

/** A fixed theme icon next to the menu UI. Decorative: never takes a tap, never read aloud, nothing on the admin. */
export function ThemeAccent({ place, index = 0 }: ThemeAccentProps) {
  const theme = accentTheme(useTheme())
  if (!theme || !accentShown(place, index)) return null
  const accents = THEME_ACCENTS[theme]
  const icon = (name: string) => <img src={themeIcons[name as keyof typeof themeIcons]} alt="" draggable={false} />

  let content: ReactNode
  let variant = ''
  if (place === 'logo') {
    variant = accents.hat
    content = accents.hat === 'mask' ? icon('performingArts') : HATS[accents.hat]
  } else if (place === 'rule') {
    content = icon(accents.rule)
  } else if (place === 'garland') {
    content = <Garland kind={accents.garland.kind} colors={accents.garland.colors} />
  } else if (place === 'chip') {
    content = icon(accents.chips[index % accents.chips.length])
  } else if (place === 'label') {
    content = icon(accents.label)
  } else {
    content = icon(accents.cards[index % accents.cards.length])
  }

  return (
    <span
      className={`theme-fx theme-fx--${place}${variant ? ` theme-fx--${variant}` : ''}`}
      data-theme-accent={place}
      data-level={ACCENT_LEVEL}
      aria-hidden="true"
    >
      {content}
    </span>
  )
}
