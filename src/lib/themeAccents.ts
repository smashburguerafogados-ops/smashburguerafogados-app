import type { ThemeId } from './theme'

export type AccentLevel = 'sutil' | 'medio' | 'festivo'

/** How many fixed icons the themes show on the cardápio. Change this one value to switch the intensity. */
export const ACCENT_LEVEL: AccentLevel = 'medio'

export type AccentPlace = 'logo' | 'rule' | 'garland' | 'chip' | 'label' | 'card'

const PLACES: Record<AccentLevel, readonly AccentPlace[]> = {
  sutil: ['logo', 'rule', 'chip'],
  medio: ['logo', 'rule', 'chip', 'label'],
  festivo: ['logo', 'rule', 'garland', 'chip', 'label', 'card'],
}

const CHIP_COUNT: Record<AccentLevel, number> = { sutil: 1, medio: 1, festivo: 3 }
const CARD_COUNT = 2

export type Hat = 'santa' | 'party' | 'mask' | 'bunny' | 'straw'
export type GarlandKind = 'lights' | 'bunting' | 'eggs'

export type ThemeAccents = {
  hat: Hat
  /** Icon on the gold rule under the wordmark. */
  rule: string
  chips: string[]
  label: string
  cards: string[]
  garland: { kind: GarlandKind; colors: string[] }
}

export type AccentTheme = Exclude<ThemeId, 'atual'>

export const THEME_ACCENTS: Record<AccentTheme, ThemeAccents> = {
  natal: {
    hat: 'santa',
    rule: 'snowflake',
    chips: ['star', 'candy', 'pine'],
    label: 'wrappedGift',
    cards: ['candy', 'bell'],
    garland: { kind: 'lights', colors: ['#e23b3b', '#2fa35b', '#e3b15a', '#ffffff'] },
  },
  'ano-novo': {
    hat: 'party',
    rule: 'sparkles',
    chips: ['sparkles', 'star', 'partyPopper'],
    label: 'confettiBall',
    cards: ['sparkles', 'star'],
    garland: { kind: 'lights', colors: ['#e3b15a', '#f4f5f6', '#c9c9c9', '#f2c14e'] },
  },
  carnaval: {
    hat: 'mask',
    rule: 'maracas',
    chips: ['confettiBall', 'balloon', 'notes'],
    label: 'partyPopper',
    cards: ['confettiBall', 'balloon'],
    garland: { kind: 'bunting', colors: ['#009c3b', '#ff4f9a', '#ffe14d', '#2f6fed'] },
  },
  pascoa: {
    hat: 'bunny',
    rule: 'tulip',
    chips: ['egg', 'chick', 'blossom'],
    label: 'basket',
    cards: ['egg', 'blossom'],
    garland: { kind: 'eggs', colors: ['#f6d86b', '#c9a0dc', '#9fd8a5', '#f6a5c0'] },
  },
  'sao-joao': {
    hat: 'straw',
    rule: 'corn',
    chips: ['balloon', 'popcorn', 'fire'],
    label: 'popcorn',
    cards: ['corn', 'pepper'],
    garland: { kind: 'bunting', colors: ['#e23b3b', '#f6d03b', '#009c3b', '#1d4ed8', '#f15a22'] },
  },
}

export function accentTheme(theme: ThemeId): AccentTheme | null {
  return theme === 'atual' ? null : theme
}

export function accentShown(place: AccentPlace, index: number, level: AccentLevel = ACCENT_LEVEL): boolean {
  if (!PLACES[level].includes(place)) return false
  if (place === 'chip') return index < CHIP_COUNT[level]
  if (place === 'card') return index < CARD_COUNT
  return index === 0
}
