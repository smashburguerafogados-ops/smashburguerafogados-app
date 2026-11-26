import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clock } from '../lib/clock'
import {
  DAY_KEYS,
  DAY_NAMES,
  DEFAULT_SCHEDULE,
  formatClock,
  recifeParts,
  scheduleProblem,
  type DayKey,
  type WeekSchedule,
} from '../lib/schedule'
import {
  DEFAULT_CLOSED_MESSAGE,
  evaluateShop,
  saveSchedule,
  saveShop,
  useShopState,
  watchShop,
  type ShopSettings,
} from '../lib/shop'
import { CloseButton } from './Overlay'

export function ShopScreen({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="product-screen" role="dialog" aria-modal="true" aria-label="Funcionamento">
      <div className="product-screen__inner">
        <div className="product-screen__bar">
          <h2>Funcionamento</h2>
          <CloseButton onClick={onClose} />
        </div>
        <ShopControls />
      </div>
    </div>
  )
}

function minuteToInput(minute: number): string {
  const hours = String(Math.floor(minute / 60)).padStart(2, '0')
  return `${hours}:${String(minute % 60).padStart(2, '0')}`
}

function inputToMinute(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Number.NaN
}

function sameSchedule(a: WeekSchedule, b: WeekSchedule): boolean {
  return DAY_KEYS.every((key) => a[key].open === b[key].open && a[key].from === b[key].from && a[key].to === b[key].to)
}

function statusLine(state: ReturnType<typeof evaluateShop>): string {
  if (state.reason === 'open') return 'Agora: aberto pela agenda.'
  if (state.reason === 'manual') {
    return state.manualUntilMs === null
      ? 'Agora: fechado manualmente. Ligue o interruptor para voltar à agenda.'
      : `Agora: fechado manualmente até ${formatClock(recifeParts(state.manualUntilMs).minute)}.`
  }
  return `Agora: fechado pela agenda. ${state.message}`
}

function ShopControls(): ReactNode {
  const [shop, setShop] = useState<ShopSettings>({
    online: true,
    closedAtMs: null,
    message: DEFAULT_CLOSED_MESSAGE,
    schedule: DEFAULT_SCHEDULE,
    deliveryFeeCents: 0,
  })
  const [draft, setDraft] = useState(DEFAULT_CLOSED_MESSAGE)
  const [week, setWeek] = useState<WeekSchedule>(DEFAULT_SCHEDULE)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dirty = useRef(false)
  const weekDirty = useRef(false)
  const state = useShopState(shop)

  useEffect(
    () =>
      watchShop(
        (next) => {
          setShop(next)
          if (!dirty.current) setDraft(next.message)
          if (!weekDirty.current) setWeek(next.schedule)
        },
        () => setError('Não foi possível carregar o status da loja.'),
      ),
    [],
  )

  async function toggle() {
    setError('')
    setNotice('')
    const online = state.manualClosed
    const next = { ...shop, online, closedAtMs: online ? null : clock.now(), message: draft }
    if (!online && !evaluateShop(next, clock.now()).manualClosed) {
      setNotice('Fora do horário a loja já fica fechada pela agenda. O fechamento manual vale só durante o expediente.')
      return
    }
    setShop(next)
    try {
      await saveShop(next)
    } catch {
      setError('Não foi possível atualizar a loja.')
    }
  }

  async function saveMessage() {
    setError('')
    setNotice('')
    const next = { ...shop, message: draft }
    dirty.current = false
    setShop(next)
    try {
      await saveShop(next)
    } catch {
      setError('Não foi possível salvar a mensagem.')
    }
  }

  function editDay(key: DayKey, patch: Partial<WeekSchedule[DayKey]>) {
    weekDirty.current = true
    setNotice('')
    setWeek((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
  }

  async function saveWeek() {
    setError('')
    setNotice('')
    const problem = scheduleProblem(week)
    if (problem) {
      setError(problem)
      return
    }
    try {
      await saveSchedule(week)
      weekDirty.current = false
      setShop((current) => ({ ...current, schedule: week }))
      setNotice('Agenda salva.')
    } catch {
      setError('Não foi possível salvar a agenda.')
    }
  }

  return (
    <section className="shop-controls" aria-label="Funcionamento">
      <p className="shop-controls__state" role="status">
        {statusLine(state)}
      </p>
      <div className="shop-controls__row">
        <span>Online</span>
        <button
          type="button"
          role="switch"
          aria-checked={!state.manualClosed}
          aria-label="Online"
          onClick={() => void toggle()}
        >
          <span className="shop-controls__knob" />
        </button>
      </div>
      <p className="muted shop-controls__hint">
        A agenda abre e fecha a loja sozinha (horário de Recife). O interruptor só fecha antes da hora, durante o
        expediente, e volta à agenda no fim dele. Ele não abre a loja fora do horário.
      </p>

      <fieldset className="shop-schedule">
        <legend>Agenda da semana</legend>
        {DAY_KEYS.map((key) => {
          const day = week[key]
          const name = DAY_NAMES[key].name
          return (
            <div key={key} className="shop-schedule__row">
              <label className="shop-schedule__day">
                <input
                  type="checkbox"
                  checked={day.open}
                  aria-label={`Abrir ${name}`}
                  onChange={(event) => editDay(key, { open: event.target.checked })}
                />
                <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
              </label>
              {day.open ? (
                <span className="shop-schedule__times">
                  <input
                    type="time"
                    aria-label={`Abre ${name}`}
                    value={minuteToInput(day.from)}
                    onChange={(event) => editDay(key, { from: inputToMinute(event.target.value) })}
                  />
                  <span aria-hidden="true">às</span>
                  <input
                    type="time"
                    aria-label={`Fecha ${name}`}
                    value={minuteToInput(day.to)}
                    onChange={(event) => editDay(key, { to: inputToMinute(event.target.value) })}
                  />
                </span>
              ) : (
                <span className="shop-schedule__closed">Fechado o dia todo</span>
              )}
            </div>
          )
        })}
        <div className="shop-schedule__actions">
          <button type="button" className="btn btn--ghost" onClick={() => void saveWeek()}>
            Salvar agenda
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={sameSchedule(week, DEFAULT_SCHEDULE)}
            onClick={() => {
              weekDirty.current = true
              setWeek(DEFAULT_SCHEDULE)
            }}
          >
            Restaurar horário padrão
          </button>
        </div>
      </fieldset>

      <label className="field">
        <span>Mensagem de fechado</span>
        <textarea
          rows={3}
          maxLength={280}
          value={draft}
          onChange={(event) => {
            dirty.current = true
            setDraft(event.target.value)
          }}
        />
      </label>
      <p className="muted shop-controls__hint">
        Aparece quando você fecha pelo interruptor. Fora do horário, o cliente vê quando a loja abre de novo.
      </p>
      <button type="button" className="btn btn--ghost" onClick={() => void saveMessage()}>
        Salvar mensagem
      </button>
      {notice && <p className="muted" role="status">{notice}</p>}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
