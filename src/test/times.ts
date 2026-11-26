/** An instant given as Recife wall-clock time (UTC-3, no daylight saving). */
export function recife(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): number {
  return Date.UTC(year, month - 1, day, hour + 3, minute, second, ms)
}

/** Thursday 2026-11-26, 18:00 in Recife: inside the opening hours. */
export const OPEN_THURSDAY_MS = recife(2026, 11, 26, 18)
