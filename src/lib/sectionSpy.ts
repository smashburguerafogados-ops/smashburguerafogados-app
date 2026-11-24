import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/** Distance below the sticky chips where a section title counts as "current". */
const LINE_GAP = 24
/** Quiet time after the last scroll event before a chip-driven scroll is considered done. */
const SETTLE_MS = 140
const USER_SCROLL_PX = 24

export function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Phase = 'free' | 'moving' | 'pinned'

/**
 * Scroll-spy for the menu sections. `active` is the category id of the section under the sticky chips
 * ('' above the first one). Watching uses an IntersectionObserver on a thin band right under the chips,
 * so it only wakes up when a section crosses that line. A tap on a chip keeps its own answer until the
 * person scrolls again, so the gold pill does not hop around while the page glides there.
 */
export function useSectionSpy(chips: RefObject<HTMLElement | null>, watchKey: string) {
  const [active, setActive] = useState('')
  const phase = useRef<Phase>('free')
  const pinnedAt = useRef(0)
  const timer = useRef(0)

  useEffect(() => {
    const row = chips.current
    if (!row) return
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-section]')).filter(
      (node) => node.dataset.section,
    )
    const end = document.querySelector<HTMLElement>('[data-menu-end]')
    let atEnd = false
    let observer: IntersectionObserver | null = null
    let endObserver: IntersectionObserver | null = null

    const line = () => {
      const stuck = Number.parseFloat(getComputedStyle(row).top) || 0
      return stuck + row.offsetHeight + LINE_GAP
    }

    function read() {
      if (phase.current !== 'free') return
      let current = ''
      const limit = line()
      for (const node of sections) {
        const box = node.getBoundingClientRect()
        if (box.height > 0 && box.top <= limit) current = node.dataset.section ?? ''
      }
      const last = sections[sections.length - 1]
      if (atEnd && window.scrollY > 0 && last && last.getBoundingClientRect().height > 0) current = last.dataset.section ?? ''
      setActive(current)
    }

    function watch() {
      observer?.disconnect()
      if (typeof IntersectionObserver === 'undefined') return
      const top = Math.round(line())
      const bottom = Math.max(0, window.innerHeight - top - 1)
      observer = new IntersectionObserver(read, { rootMargin: `-${top}px 0px -${bottom}px 0px` })
      for (const node of sections) observer.observe(node)
    }

    if (typeof IntersectionObserver !== 'undefined' && end) {
      endObserver = new IntersectionObserver((entries) => {
        atEnd = entries.some((entry) => entry.isIntersecting)
        read()
      })
      endObserver.observe(end)
    }

    function pin() {
      phase.current = 'pinned'
      pinnedAt.current = window.scrollY
    }

    function onScroll() {
      if (phase.current === 'moving') {
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(pin, SETTLE_MS)
      } else if (phase.current === 'pinned' && Math.abs(window.scrollY - pinnedAt.current) > USER_SCROLL_PX) {
        phase.current = 'free'
        read()
      }
    }

    function onTouch() {
      if (phase.current !== 'moving') return
      window.clearTimeout(timer.current)
      phase.current = 'free'
      read()
    }

    function onResize() {
      watch()
      read()
    }

    watch()
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', onTouch, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      observer?.disconnect()
      endObserver?.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('wheel', onTouch)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('resize', onResize)
      window.clearTimeout(timer.current)
    }
  }, [chips, watchKey])

  const goTo = useCallback((id: string) => {
    const behavior: ScrollBehavior = reducedMotion() ? 'auto' : 'smooth'
    phase.current = 'moving'
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      phase.current = 'pinned'
      pinnedAt.current = window.scrollY
    }, SETTLE_MS * 2.5)
    setActive(id)
    const target = id ? document.querySelector<HTMLElement>(`[data-section="${id}"]`) : null
    if (target) target.scrollIntoView?.({ behavior, block: 'start' })
    else window.scrollTo?.({ top: 0, behavior })
  }, [])

  return { active, goTo }
}
