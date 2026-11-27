import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SCHEDULE,
  closedByScheduleMessage,
  readSchedule,
  recifeParts,
  scheduleProblem,
  summarizeSchedule,
  windowAt,
  type WeekSchedule,
} from './lib/schedule'
import { DEFAULT_CLOSED_MESSAGE, evaluateShop, type ShopSettings } from './lib/shop'
import { recife } from './test/times'

function shop(overrides: Partial<ShopSettings> = {}): ShopSettings {
  return {
    online: true,
    closedAtMs: null,
    message: DEFAULT_CLOSED_MESSAGE,
    schedule: DEFAULT_SCHEDULE,
    deliveryFeeCents: 0,
    ...overrides,
  }
}

const isOpen = (ms: number, settings = shop()) => evaluateShop(settings, ms).open

// 2026-11-23 is a Monday.
const MON = 23
const TUE = 24
const WED = 25
const THU = 26
const FRI = 27
const SAT = 28
const SUN = 29

describe('default week: open Mon, Tue and Thu to Sun from 16:00 to 23:00, closed Wednesday', () => {
  it('is closed at 15:59 and open at 16:00', () => {
    expect(isOpen(recife(2026, 11, THU, 15, 59, 59, 999))).toBe(false)
    expect(isOpen(recife(2026, 11, THU, 16, 0))).toBe(true)
  })

  it('is open at 22:59 and closed at exactly 23:00', () => {
    expect(isOpen(recife(2026, 11, THU, 22, 59, 59, 999))).toBe(true)
    expect(isOpen(recife(2026, 11, THU, 23, 0))).toBe(false)
  })

  it('is closed all day Wednesday, including 16:00 to 23:00', () => {
    for (const [h, m] of [[0, 0], [10, 0], [16, 0], [19, 30], [22, 59], [23, 59]]) {
      expect(isOpen(recife(2026, 11, WED, h, m))).toBe(false)
    }
  })

  it('opens on every other weekday at 18:00', () => {
    for (const day of [MON, TUE, THU, FRI, SAT, SUN]) {
      expect(isOpen(recife(2026, 11, day, 18, 0))).toBe(true)
    }
  })

  it('crosses from Sunday night to Monday', () => {
    expect(isOpen(recife(2026, 11, SUN, 22, 59, 59))).toBe(true)
    expect(isOpen(recife(2026, 11, SUN, 23, 0))).toBe(false)
    expect(isOpen(recife(2026, 11, 30, 0, 0))).toBe(false)
    expect(isOpen(recife(2026, 11, 30, 15, 59))).toBe(false)
    expect(isOpen(recife(2026, 11, 30, 16, 0))).toBe(true)
    expect(closedByScheduleMessage(DEFAULT_SCHEDULE, recife(2026, 11, SUN, 23, 30))).toBe('Abrimos amanhã às 16h')
  })

  it('crosses from Tuesday night over Wednesday to Thursday', () => {
    expect(isOpen(recife(2026, 11, TUE, 22, 59))).toBe(true)
    expect(isOpen(recife(2026, 11, TUE, 23, 0))).toBe(false)
    expect(isOpen(recife(2026, 11, THU, 16, 0))).toBe(true)
  })
})

describe('time zone', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each(['Pacific/Auckland', 'America/Los_Angeles', 'Asia/Tokyo', 'UTC'])(
    'decides in Recife even when the device is in %s',
    (zone) => {
      vi.stubEnv('TZ', zone)
      const probe = recife(2026, 11, THU, 15, 59, 59)
      expect(new Date(probe).getHours()).not.toBe(15)
      expect(isOpen(recife(2026, 11, THU, 15, 59, 59))).toBe(false)
      expect(isOpen(recife(2026, 11, THU, 16, 0))).toBe(true)
      expect(isOpen(recife(2026, 11, THU, 22, 59, 59))).toBe(true)
      expect(isOpen(recife(2026, 11, THU, 23, 0))).toBe(false)
      expect(isOpen(recife(2026, 11, WED, 18, 0))).toBe(false)
      expect(recifeParts(recife(2026, 11, WED, 18, 5, 7))).toEqual({ day: 2, minute: 18 * 60 + 5, second: 7 })
    },
  )

  it('reads the instant 21:00 UTC as 18:00 in Recife', () => {
    expect(recifeParts(Date.UTC(2026, 10, 26, 21, 0, 0))).toEqual({ day: 3, minute: 18 * 60, second: 0 })
    expect(recifeParts(Date.UTC(2026, 10, 27, 2, 59, 59)).minute).toBe(24 * 60 - 1)
    expect(recifeParts(Date.UTC(2026, 10, 27, 2, 59, 59)).day).toBe(3)
    expect(recifeParts(Date.UTC(2026, 10, 27, 3, 0, 0))).toEqual({ day: 4, minute: 0, second: 0 })
  })
})

describe('customer message when closed', () => {
  it('says the shop opens today before 16:00', () => {
    expect(closedByScheduleMessage(DEFAULT_SCHEDULE, recife(2026, 11, THU, 10, 0))).toBe('Abrimos hoje às 16h')
  })

  it('says the shop opens tomorrow after closing', () => {
    expect(closedByScheduleMessage(DEFAULT_SCHEDULE, recife(2026, 11, THU, 23, 0))).toBe('Abrimos amanhã às 16h')
  })

  it('names Thursday after Tuesday night, since Wednesday is closed', () => {
    expect(closedByScheduleMessage(DEFAULT_SCHEDULE, recife(2026, 11, TUE, 23, 30))).toBe('Abrimos quinta às 16h')
  })

  it('explains the closed Wednesday', () => {
    for (const hour of [0, 12, 18, 23]) {
      expect(closedByScheduleMessage(DEFAULT_SCHEDULE, recife(2026, 11, WED, hour, 0))).toBe(
        'Fechado às quartas. Abrimos quinta às 16h',
      )
    }
  })

  it('uses the edited opening time', () => {
    const edited: WeekSchedule = { ...DEFAULT_SCHEDULE, thu: { open: true, from: 17 * 60 + 30, to: 22 * 60 } }
    expect(closedByScheduleMessage(edited, recife(2026, 11, THU, 9, 0))).toBe('Abrimos hoje às 17h30')
    expect(isOpen(recife(2026, 11, THU, 17, 29), shop({ schedule: edited }))).toBe(false)
    expect(isOpen(recife(2026, 11, THU, 21, 59), shop({ schedule: edited }))).toBe(true)
    expect(isOpen(recife(2026, 11, THU, 22, 0), shop({ schedule: edited }))).toBe(false)
  })

  it('handles a week with no open day', () => {
    const none = readSchedule(Object.fromEntries(Object.keys(DEFAULT_SCHEDULE).map((key) => [key, { open: false }])))
    expect(windowAt(none, recife(2026, 11, THU, 18))).toBeNull()
    expect(evaluateShop(shop({ schedule: none }), recife(2026, 11, THU, 18))).toMatchObject({ open: false, nextChangeMs: null })
  })
})

describe('next transition', () => {
  it('points at 23:00 while open and at the next opening while closed', () => {
    expect(evaluateShop(shop(), recife(2026, 11, THU, 18)).nextChangeMs).toBe(recife(2026, 11, THU, 23))
    expect(evaluateShop(shop(), recife(2026, 11, THU, 23)).nextChangeMs).toBe(recife(2026, 11, FRI, 16))
    expect(evaluateShop(shop(), recife(2026, 11, TUE, 23, 30)).nextChangeMs).toBe(recife(2026, 11, THU, 16))
    expect(evaluateShop(shop(), recife(2026, 11, WED, 12)).nextChangeMs).toBe(recife(2026, 11, THU, 16))
    expect(evaluateShop(shop(), recife(2026, 11, SUN, 23, 30)).nextChangeMs).toBe(recife(2026, 11, 30, 16))
  })
})

describe('manual switch', () => {
  const during = recife(2026, 11, THU, 18)

  it('closes the shop inside the schedule with the admin message', () => {
    const closed = shop({ online: false, closedAtMs: during, message: 'Acabou o pão.' })
    expect(evaluateShop(closed, recife(2026, 11, THU, 19))).toMatchObject({
      open: false,
      reason: 'manual',
      message: 'Acabou o pão.',
      manualClosed: true,
    })
  })

  it('tells the customer when the shop opens again after a manual close', () => {
    const closed = shop({ online: false, closedAtMs: during, message: 'Acabou o pão.' })
    expect(evaluateShop(closed, recife(2026, 11, THU, 19)).notice).toBe('Acabou o pão. Abrimos amanhã às 16h')
    const tuesday = shop({ online: false, closedAtMs: recife(2026, 11, TUE, 18), message: 'Acabou o pão.' })
    expect(evaluateShop(tuesday, recife(2026, 11, TUE, 19)).notice).toBe('Acabou o pão. Abrimos quinta às 16h')
    const legacy = shop({ online: false, closedAtMs: null, message: 'Acabou o pão.' })
    expect(evaluateShop(legacy, recife(2026, 11, THU, 19)).notice).toBe('Acabou o pão.')
  })

  it('has no notice while open and the schedule message while closed by the schedule', () => {
    expect(evaluateShop(shop(), recife(2026, 11, THU, 18)).notice).toBe('')
    expect(evaluateShop(shop(), recife(2026, 11, THU, 10)).notice).toBe('Abrimos hoje às 16h')
    expect(evaluateShop(shop(), recife(2026, 11, WED, 18)).notice).toBe('Fechado às quartas. Abrimos quinta às 16h')
  })

  it('ends with the opening window and the schedule takes over', () => {
    const closed = shop({ online: false, closedAtMs: during })
    expect(isOpen(recife(2026, 11, THU, 22, 59), closed)).toBe(false)
    expect(isOpen(recife(2026, 11, FRI, 16, 0), closed)).toBe(true)
    expect(evaluateShop(closed, recife(2026, 11, THU, 19)).nextChangeMs).toBe(recife(2026, 11, THU, 23))
  })

  it('can close tonight in the morning', () => {
    const closed = shop({ online: false, closedAtMs: recife(2026, 11, THU, 10) })
    expect(isOpen(recife(2026, 11, THU, 16, 30), closed)).toBe(false)
    expect(isOpen(recife(2026, 11, FRI, 16, 30), closed)).toBe(true)
  })

  it('does nothing when switched off after closing time, so tomorrow opens normally', () => {
    const closed = shop({ online: false, closedAtMs: recife(2026, 11, THU, 23, 30) })
    expect(evaluateShop(closed, recife(2026, 11, THU, 23, 31)).manualClosed).toBe(false)
    expect(isOpen(recife(2026, 11, FRI, 17), closed)).toBe(true)
  })

  it('keeps an older close without a time until the admin turns it on', () => {
    const legacy = shop({ online: false, closedAtMs: null })
    expect(isOpen(recife(2026, 11, THU, 18), legacy)).toBe(false)
    expect(isOpen(recife(2026, 11, FRI, 18), legacy)).toBe(false)
    expect(evaluateShop(legacy, recife(2026, 11, FRI, 18)).manualClosed).toBe(true)
  })

  it('never opens the shop outside the schedule', () => {
    expect(isOpen(recife(2026, 11, WED, 18), shop({ online: true }))).toBe(false)
    expect(isOpen(recife(2026, 11, THU, 15, 59), shop({ online: true }))).toBe(false)
  })
})

describe('stored schedule', () => {
  it('falls back to the default for missing or invalid days', () => {
    const week = readSchedule({
      mon: { open: true, from: 600, to: 500 },
      tue: { open: 'sim' },
      wed: { open: true, from: 17 * 60, to: 22 * 60 },
      thu: { open: false },
      fri: null,
    })
    expect(week.mon).toEqual(DEFAULT_SCHEDULE.mon)
    expect(week.tue).toEqual(DEFAULT_SCHEDULE.tue)
    expect(week.wed).toEqual({ open: true, from: 1020, to: 1320 })
    expect(week.thu.open).toBe(false)
    expect(week.fri).toEqual(DEFAULT_SCHEDULE.fri)
    expect(readSchedule(undefined)).toEqual(DEFAULT_SCHEDULE)
  })

  it('rejects an edited day that closes before it opens', () => {
    expect(scheduleProblem(DEFAULT_SCHEDULE)).toBe('')
    expect(scheduleProblem({ ...DEFAULT_SCHEDULE, fri: { open: true, from: 1380, to: 960 } })).toContain('sexta')
    expect(scheduleProblem({ ...DEFAULT_SCHEDULE, fri: { open: false, from: 1380, to: 960 } })).toBe('')
  })

  it('summarizes the default week', () => {
    expect(summarizeSchedule(DEFAULT_SCHEDULE)).toBe('Seg–Ter e Qui–Dom, 16h às 23h · Fechado às quartas')
  })
})
