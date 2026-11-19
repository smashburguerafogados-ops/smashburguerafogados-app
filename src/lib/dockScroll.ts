const SHOW_AT = 4
const STEP = 12

export function stepDock(hidden: boolean, anchor: number, top: number): { hidden: boolean; anchor: number } {
  if (top <= SHOW_AT) return { hidden: false, anchor: top }
  const delta = top - anchor
  if (delta > STEP) return { hidden: true, anchor: top }
  if (delta < -STEP) return { hidden: false, anchor: top }
  return { hidden, anchor }
}

export function scrollTopOf(target: EventTarget | null): number | null {
  if (!target) return null
  if (target instanceof Element) return target.scrollTop
  if (target === document || target === document.body) {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  }
  if ('scrollY' in target && typeof (target as Window).scrollY === 'number') {
    return (target as Window).scrollY || window.scrollY || 0
  }
  return null
}
