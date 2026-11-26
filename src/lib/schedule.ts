/**
 * Weekly opening schedule. Every decision uses America/Recife (UTC-3, no
 * daylight saving), never the time zone of the customer's device.
 *
 * Rule of precedence:
 *   1. Outside the schedule the shop is closed. Nobody can force it open.
 *   2. Inside the schedule the shop is open, unless the admin closed it by hand.
 *   3. A manual close only lasts for the opening window it was made in (or the
 *      one that starts later the same day). After that the schedule takes over.
 *      A close saved without a time (older setting) lasts until the admin
 *      turns the switch on again.
 */

export const TIME_ZONE = 'America/Recife'

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type DayKey = (typeof DAY_KEYS)[number]

/** `from` and `to` are minutes after midnight in Recife. `to` is the first closed minute. */
export type DaySchedule = { open: boolean; from: number; to: number }
export type WeekSchedule = Record<DayKey, DaySchedule>

export const OPEN_MINUTE = 16 * 60
export const CLOSE_MINUTE = 23 * 60

export const DEFAULT_SCHEDULE: WeekSchedule = {
  mon: { open: true, from: OPEN_MINUTE, to: CLOSE_MINUTE },
  tue: { open: true, from: OPEN_MINUTE, to: CLOSE_MINUTE },
  wed: { open: false, from: OPEN_MINUTE, to: CLOSE_MINUTE },
  thu: { open: true, from: OPEN_MINUTE, to: CLOSE_MINUTE },
  fri: { open: true, from: OPEN_MINUTE, to: CLOSE_MINUTE },
  sat: { open: true, from: OPEN_MINUTE, to: CLOSE_MINUTE },
  sun: { open: true, from: OPEN_MINUTE, to: CLOSE_MINUTE },
}

export const DAY_NAMES: Record<DayKey, { name: string; short: string; plural: string }> = {
  mon: { name: 'segunda', short: 'Seg', plural: 'às segundas' },
  tue: { name: 'terça', short: 'Ter', plural: 'às terças' },
  wed: { name: 'quarta', short: 'Qua', plural: 'às quartas' },
  thu: { name: 'quinta', short: 'Qui', plural: 'às quintas' },
  fri: { name: 'sexta', short: 'Sex', plural: 'às sextas' },
  sat: { name: 'sábado', short: 'Sáb', plural: 'aos sábados' },
  sun: { name: 'domingo', short: 'Dom', plural: 'aos domingos' },
}

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

export function isMinute(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 24 * 60
}

/** Reads the stored schedule. Anything missing or invalid falls back to the default for that day. */
export function readSchedule(raw: unknown): WeekSchedule {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const week = { ...DEFAULT_SCHEDULE }
  for (const key of DAY_KEYS) {
    const day = source[key]
    if (!day || typeof day !== 'object') continue
    const { open, from, to } = day as Record<string, unknown>
    if (typeof open !== 'boolean') continue
    if (!open) {
      week[key] = { ...DEFAULT_SCHEDULE[key], open: false }
      continue
    }
    if (isMinute(from) && isMinute(to) && from < to) week[key] = { open: true, from, to }
  }
  return week
}

/** The first problem with an edited schedule, or an empty string when it can be saved. */
export function scheduleProblem(week: WeekSchedule): string {
  for (const key of DAY_KEYS) {
    const day = week[key]
    if (day.open && !(isMinute(day.from) && isMinute(day.to) && day.from < day.to)) {
      return `Em ${DAY_NAMES[key].name}, o horário de abrir precisa ser antes do de fechar.`
    }
  }
  return ''
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    })
    formatterCache.set(timeZone, formatter)
  }
  return formatter
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

/** Weekday (0 = Monday) and time of day in Recife for an instant. */
export function recifeParts(ms: number): { day: number; minute: number; second: number } {
  const parts = formatterFor(TIME_ZONE).formatToParts(new Date(ms))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const hour = Number(get('hour')) % 24
  return {
    day: WEEKDAY_INDEX[get('weekday')] ?? 0,
    minute: hour * 60 + Number(get('minute')),
    second: Number(get('second')),
  }
}

/** The instant Recife's midnight started for the day that contains `ms`. */
export function recifeDayStart(ms: number): number {
  const { minute, second } = recifeParts(ms)
  const sinceMidnight = (minute * 60 + second) * 1000 + (((ms % 1000) + 1000) % 1000)
  return ms - sinceMidnight
}

export type OpeningWindow = {
  /** True when `ms` is inside this window. Otherwise it is the next one. */
  current: boolean
  startMs: number
  endMs: number
  day: DayKey
  from: number
  /** Whole days between the day of `ms` and the day this window starts. */
  daysAhead: number
}

/** The window that contains `ms`, or else the next one to start. Null when no day is open. */
export function windowAt(week: WeekSchedule, ms: number): OpeningWindow | null {
  const { day: today, minute } = recifeParts(ms)
  const midnight = recifeDayStart(ms)
  for (let ahead = 0; ahead <= 7; ahead += 1) {
    const key = DAY_KEYS[(today + ahead) % 7]
    const entry = week[key]
    if (!entry.open) continue
    if (ahead === 0 && minute >= entry.to) continue
    const startMs = midnight + ahead * DAY_MS + entry.from * MINUTE_MS
    const endMs = midnight + ahead * DAY_MS + entry.to * MINUTE_MS
    return { current: ahead === 0 && minute >= entry.from, startMs, endMs, day: key, from: entry.from, daysAhead: ahead }
  }
  return null
}

export function formatClock(minute: number): string {
  const hours = Math.floor(minute / 60)
  const rest = minute % 60
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`
}

/** "16h às 23h" style summary for the splash and the menu header. */
export function summarizeSchedule(week: WeekSchedule): string {
  const groups = new Map<string, DayKey[][]>()
  let run: DayKey[] = []
  const flush = () => {
    if (run.length === 0) return
    const first = week[run[0]]
    const id = `${first.from}-${first.to}`
    groups.set(id, [...(groups.get(id) ?? []), run])
    run = []
  }
  for (const key of DAY_KEYS) {
    const day = week[key]
    if (!day.open) {
      flush()
      continue
    }
    const last = run[run.length - 1]
    if (last && (week[last].from !== day.from || week[last].to !== day.to)) flush()
    run.push(key)
  }
  flush()

  const label = (days: DayKey[]) =>
    days.length === 1
      ? DAY_NAMES[days[0]].short
      : `${DAY_NAMES[days[0]].short}–${DAY_NAMES[days[days.length - 1]].short}`
  const parts = [...groups.entries()].map(([id, runs]) => {
    const [from, to] = id.split('-').map(Number)
    return `${runs.map(label).join(' e ')}, ${formatClock(from)} às ${formatClock(to)}`
  })
  const closed = DAY_KEYS.filter((key) => !week[key].open)
  if (closed.length === 1) parts.push(`Fechado ${DAY_NAMES[closed[0]].plural}`)
  else if (closed.length > 1) parts.push(`Fechado: ${closed.map((key) => DAY_NAMES[key].short).join(', ')}`)
  return parts.join(' · ')
}

/** What the customer reads while the schedule keeps the shop closed. */
export function closedByScheduleMessage(week: WeekSchedule, ms: number): string {
  const next = windowAt(week, ms)
  if (!next) return 'Estamos fechados no momento.'
  const { day: today } = recifeParts(ms)
  const todayKey = DAY_KEYS[today]
  const when =
    next.daysAhead === 0 ? 'hoje' : next.daysAhead === 1 && week[todayKey].open ? 'amanhã' : DAY_NAMES[next.day].name
  const opens = `Abrimos ${when} às ${formatClock(next.from)}`
  return week[todayKey].open ? opens : `Fechado ${DAY_NAMES[todayKey].plural}. ${opens}`
}
