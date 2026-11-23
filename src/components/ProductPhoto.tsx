import { useEffect, useRef, useState } from 'react'
import { FALLBACK_IMAGE, PHOTO_PLACEHOLDER, isPhotoRef, loadPhoto, peekPhoto } from '../lib/productPhotos'

type ProductPhotoProps = {
  src: string
  className?: string
  alt?: string
  /** Load right away instead of waiting for the photo to come near the screen. */
  eager?: boolean
}

const NEAR_SCREEN = '300px 0px'

/**
 * A product image. Inline data URLs and plain URLs render as before. A
 * "photo:" reference shows a dark tile first and reads the photo only when it
 * gets near the screen; if the photo cannot be read, the default image shows.
 */
export function ProductPhoto({ src, className, alt = '', eager = false }: ProductPhotoProps) {
  const ref = isPhotoRef(src)
  const [shown, setShown] = useState(() => peekPhoto(src))
  const [shownFor, setShownFor] = useState(src)
  const node = useRef<HTMLImageElement | null>(null)

  let current = shown
  if (shownFor !== src) {
    current = peekPhoto(src)
    setShownFor(src)
    setShown(current)
  }

  useEffect(() => {
    if (!ref) return
    const ready = peekPhoto(src)
    if (ready) {
      setShown(ready)
      return
    }
    let cancelled = false
    let observer: IntersectionObserver | null = null

    function start() {
      observer?.disconnect()
      loadPhoto(src).then(
        (image) => {
          if (!cancelled) setShown(image)
        },
        () => {
          if (!cancelled) setShown(FALLBACK_IMAGE)
        },
      )
    }

    const element = node.current
    if (eager || !element || typeof IntersectionObserver === 'undefined') {
      start()
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) start()
        },
        { rootMargin: NEAR_SCREEN },
      )
      observer.observe(element)
    }
    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [src, ref, eager])

  if (!ref) {
    const inline = src.startsWith('data:')
    return <img className={className} src={src} alt={alt} decoding="async" loading={inline || eager ? undefined : 'lazy'} />
  }

  const loading = !current
  const classes = [className, loading ? 'is-loading' : ''].filter(Boolean).join(' ')
  return (
    <img
      ref={node}
      className={classes || undefined}
      src={current ?? PHOTO_PLACEHOLDER}
      alt={alt}
      decoding="async"
    />
  )
}
