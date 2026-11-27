import { useEffect, useMemo, useState } from 'react'
import { deleteField, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { clock } from './clock'
import { db } from './firebase'
import { keepListening } from './listen'
import {
  DEFAULT_SCHEDULE,
  closedByScheduleMessage,
  recifeDayStart,
  readSchedule,
  summarizeSchedule,
  windowAt,
  type WeekSchedule,
} from './schedule'

export const DEFAULT_CLOSED_MESSAGE = 'Estamos fechados no momento. Voltamos em breve!'

const LEGACY_CLOSED_MESSAGE =
  'Hoje não estamos funcionando. Nossos dias de funcionamento são de quarta a domingo.'

export type ShopSettings = {
  /** The admin's manual switch. False means closed by hand. It never opens the shop outside the schedule. */
  online: boolean
  /** When the manual close was made (ms). Absent on older settings. */
  closedAtMs: number | null
  message: string
  schedule: WeekSchedule
  /** Cents. 0 when the shop has never set a fee, so old orders are not charged one. */
  deliveryFeeCents: number
}

function readFee(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.round(value)
}

function readShop(data: Record<string, unknown> | undefined): ShopSettings {
  const message = typeof data?.message === 'string' ? data.message.trim() : ''
  return {
    online: data?.online !== false,
    closedAtMs: typeof data?.closedAtMs === 'number' && Number.isFinite(data.closedAtMs) ? data.closedAtMs : null,
    message: !message || message === LEGACY_CLOSED_MESSAGE ? DEFAULT_CLOSED_MESSAGE : message,
    schedule: readSchedule(data?.schedule),
    deliveryFeeCents: readFee(data?.deliveryFeeCents),
  }
}

export function watchShop(onNext: (shop: ShopSettings) => void, onError: () => void): () => void {
  return onSnapshot(
    doc(db, 'settings', 'shop'),
    (snapshot) => {
      onNext(readShop(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined))
    },
    () => onError(),
  )
}

export async function saveShop(shop: ShopSettings): Promise<void> {
  const message = shop.message.trim() || DEFAULT_CLOSED_MESSAGE
  // The fee and the schedule have their own writes. Saving the switch or the
  // closed message must not reset them.
  await setDoc(
    doc(db, 'settings', 'shop'),
    {
      online: shop.online,
      message,
      closedAtMs: shop.online ? deleteField() : (shop.closedAtMs ?? clock.now()),
    },
    { merge: true },
  )
}

export async function saveSchedule(schedule: WeekSchedule): Promise<void> {
  await setDoc(doc(db, 'settings', 'shop'), { schedule: readSchedule(schedule) }, { merge: true })
}

export async function saveDeliveryFee(cents: number): Promise<void> {
  const deliveryFeeCents = readFee(cents)
  await setDoc(doc(db, 'settings', 'shop'), { deliveryFeeCents }, { merge: true })
}

export type ShopReason = 'open' | 'manual' | 'schedule'

export type ShopState = {
  open: boolean
  reason: ShopReason
  /** True while the admin's manual close counts, even when the schedule is closed anyway. */
  manualClosed: boolean
  /** What the customer reads while closed. Empty while open. */
  message: string
  /** What the customer reads next to the closed sign: the reason plus when the shop opens. Empty while open. */
  notice: string
  /** Summary of the week for the splash and the menu header. */
  hours: string
  /** Next instant the answer may change, or null when it never will. */
  nextChangeMs: number | null
  /** When the manual close stops counting. Null when it has no end. */
  manualUntilMs: number | null
}

/** Where a manual close ends: the end of the window it was made in, or of one that starts the same day. */
function manualCloseEnd(settings: ShopSettings): number | null {
  if (settings.closedAtMs === null) return null
  const window = windowAt(settings.schedule, settings.closedAtMs)
  if (!window) return settings.closedAtMs
  const sameDay = recifeDayStart(window.startMs) === recifeDayStart(settings.closedAtMs)
  return window.current || sameDay ? window.endMs : settings.closedAtMs
}

export function evaluateShop(settings: ShopSettings, ms: number): ShopState {
  const hours = summarizeSchedule(settings.schedule)
  const window = windowAt(settings.schedule, ms)
  const scheduleOpen = window?.current === true
  const scheduleNext = window ? (window.current ? window.endMs : window.startMs) : null

  const until = settings.online ? null : manualCloseEnd(settings)
  const manualClosed = !settings.online && (until === null || ms < until)
  const nextChangeMs =
    manualClosed && until !== null ? (scheduleNext === null ? until : Math.min(until, scheduleNext)) : scheduleNext

  if (!scheduleOpen) {
    return {
      open: false,
      reason: 'schedule',
      manualClosed,
      message: closedByScheduleMessage(settings.schedule, ms),
      notice: closedByScheduleMessage(settings.schedule, ms),
      hours,
      nextChangeMs,
      manualUntilMs: until,
    }
  }
  if (manualClosed) {
    const reopens = until === null ? '' : closedByScheduleMessage(settings.schedule, until)
    return {
      open: false,
      reason: 'manual',
      manualClosed,
      message: settings.message,
      notice: reopens ? `${settings.message} ${reopens}` : settings.message,
      hours,
      nextChangeMs,
      manualUntilMs: until,
    }
  }
  return { open: true, reason: 'open', manualClosed, message: '', notice: '', hours, nextChangeMs, manualUntilMs: until }
}

const MAX_WAIT_MS = 15 * 60_000
const SETTLE_MS = 50

/**
 * Re-evaluates the shop at the next transition, and again whenever the tab
 * comes back to the front, regains focus or the network returns. Browsers
 * slow timers in background tabs, so those events are what keep it right.
 */
export function useShopState(settings: ShopSettings): ShopState {
  const [nowMs, setNowMs] = useState(() => clock.now())
  const state = useMemo(() => evaluateShop(settings, nowMs), [settings, nowMs])
  const nextChangeMs = state.nextChangeMs

  useEffect(() => {
    const wait = nextChangeMs === null ? MAX_WAIT_MS : Math.min(MAX_WAIT_MS, nextChangeMs - clock.now() + SETTLE_MS)
    const timer = setTimeout(() => setNowMs(clock.now()), Math.max(wait, SETTLE_MS))
    return () => clearTimeout(timer)
  }, [nextChangeMs, nowMs])

  useEffect(() => {
    function refresh() {
      if (document.visibilityState === 'hidden') return
      setNowMs(clock.now())
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('online', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [])

  return state
}

const DEFAULT_SETTINGS: ShopSettings = {
  online: true,
  closedAtMs: null,
  message: DEFAULT_CLOSED_MESSAGE,
  schedule: DEFAULT_SCHEDULE,
  deliveryFeeCents: 0,
}

export type ShopView = ShopState & {
  ready: boolean
  /** True when customers can order right now. */
  online: boolean
  deliveryFeeCents: number
  /** Answers for the current instant, for a check at the moment of an action. */
  check: () => ShopState
}

export function useShop(): ShopView {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(
    () =>
      keepListening(
        (fail) =>
          watchShop((shop) => {
            setSettings(shop)
            setReady(true)
          }, fail),
        () => {
          setSettings((current) => ({ ...current, online: true, closedAtMs: null }))
          setReady(true)
        },
      ),
    [],
  )

  const state = useShopState(settings)
  return {
    ...state,
    ready,
    online: state.open,
    deliveryFeeCents: settings.deliveryFeeCents,
    check: () => evaluateShop(settings, clock.now()),
  }
}
