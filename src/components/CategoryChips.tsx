import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { Category } from '../data/catalog'
import { CategoryIcon, iconForCategory } from '../lib/categoryIcons'
import { HOME_LABEL } from '../lib/menu'
import { reducedMotion } from '../lib/sectionSpy'
import { ThemeAccent } from './ThemeAccent'

type Pill = { x: number; y: number; w: number; h: number }

type CategoryChipsProps = {
  rowRef: RefObject<HTMLDivElement | null>
  categories: Category[]
  /** Category ids that have a section on screen. The others cannot be scrolled to. */
  available: ReadonlySet<string>
  /** The category of the section under the chips. Empty is Início. */
  active: string
  onPick: (id: string) => void
}

/** Sticky category chips. The gold pill slides to the chip of the section being read. */
export function CategoryChips({ rowRef, categories, available, active, onPick }: CategoryChipsProps) {
  const [pill, setPill] = useState<Pill | null>(null)
  const [ready, setReady] = useState(false)
  const settled = useRef(false)
  const idKey = categories.map((category) => category.id).join('|')

  useLayoutEffect(() => {
    const row = rowRef.current
    const chip = row?.querySelector<HTMLElement>('.chip.is-active')
    if (!row || !chip) return
    const place = () => setPill({ x: chip.offsetLeft, y: chip.offsetTop, w: chip.offsetWidth, h: chip.offsetHeight })
    place()
    if (typeof row.scrollTo === 'function') {
      row.scrollTo({
        left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2,
        behavior: settled.current && !reducedMotion() ? 'smooth' : 'auto',
      })
    }
    const frame = requestAnimationFrame(() => {
      settled.current = true
      setReady(true)
    })
    void document.fonts?.ready.then(place)
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    watcher?.observe(chip)
    return () => {
      cancelAnimationFrame(frame)
      watcher?.disconnect()
    }
  }, [rowRef, active, idKey])

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const refit = () => {
      const chip = row.querySelector<HTMLElement>('.chip.is-active')
      if (chip) setPill({ x: chip.offsetLeft, y: chip.offsetTop, w: chip.offsetWidth, h: chip.offsetHeight })
    }
    window.addEventListener('resize', refit)
    return () => window.removeEventListener('resize', refit)
  }, [rowRef])

  return (
    <div ref={rowRef} className="chips chips--pill" role="toolbar" aria-label="Categorias">
      {pill && (
        <span
          className={ready ? 'chips__pill is-ready' : 'chips__pill'}
          aria-hidden="true"
          style={{ transform: `translate(${pill.x}px, ${pill.y}px)`, width: pill.w, height: pill.h }}
        />
      )}
      <button
        type="button"
        className={active ? 'chip' : 'chip is-active'}
        aria-current={active ? undefined : 'true'}
        onClick={() => onPick('')}
      >
        <CategoryIcon iconKey="home" />
        {HOME_LABEL}
        <ThemeAccent place="chip" index={0} />
      </button>
      {categories.map((category, categoryIndex) => {
        const classes = ['chip']
        if (category.destaque) classes.push('chip--destaque')
        if (active === category.id) classes.push('is-active')
        return (
          <button
            key={category.id}
            type="button"
            className={classes.join(' ')}
            aria-current={active === category.id ? 'true' : undefined}
            disabled={!available.has(category.id)}
            onClick={() => onPick(category.id)}
          >
            <CategoryIcon iconKey={iconForCategory(category.name, category.icon)} />
            {category.name}
            {category.destaque && <span className="chip__sun" aria-hidden="true" />}
            <ThemeAccent place="chip" index={categoryIndex + 1} />
          </button>
        )
      })}
    </div>
  )
}
