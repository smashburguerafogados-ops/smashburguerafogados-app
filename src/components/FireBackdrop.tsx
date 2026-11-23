import { useEffect, useState } from 'react'
import { catalogLoading, catalogSettled, onCatalogSettled } from '../lib/remoteCatalog'

export const FIRE_PLAYBACK_RATE = 0.25

function keepFireCalm(video: HTMLVideoElement | null) {
  if (!video || video.playbackRate === FIRE_PLAYBACK_RATE) return
  video.playbackRate = FIRE_PLAYBACK_RATE
}

type NetworkInformationLike = { saveData?: boolean; effectiveType?: string }

/** Data saver or a 2G/3G estimate: the poster is enough, the loop would only compete with the menu. */
export function prefersStillFire(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  if (!connection) return false
  if (connection.saveData === true) return true
  return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.effectiveType === '3g'
}

function mayPlay(): boolean {
  if (catalogSettled()) return true
  return document.readyState === 'complete' && !catalogLoading()
}

/**
 * The fire loop is decoration. It starts after the page has loaded, and never
 * while the menu is still downloading, so on a slow connection the products
 * come first; until then the poster, a frame of the same loop, stands in.
 */
export function FireBackdrop() {
  const base = import.meta.env.BASE_URL
  const [still] = useState(prefersStillFire)
  const [play, setPlay] = useState(mayPlay)

  useEffect(() => {
    if (still || play) return
    function check() {
      if (mayPlay()) setPlay(true)
    }
    check()
    window.addEventListener('load', check)
    const stop = onCatalogSettled(check)
    return () => {
      window.removeEventListener('load', check)
      stop()
    }
  }, [still, play])

  return (
    <div className="fire" aria-hidden="true">
      {still || !play ? (
        <img className="fire__video" src={`${base}fire-poster.jpg`} alt="" />
      ) : (
        <video
          className="fire__video"
          src={`${base}fire.mp4`}
          poster={`${base}fire-poster.jpg`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          ref={keepFireCalm}
          onLoadedMetadata={(event) => keepFireCalm(event.currentTarget)}
          onPlay={(event) => keepFireCalm(event.currentTarget)}
          onRateChange={(event) => keepFireCalm(event.currentTarget)}
        />
      )}
      <div className="fire__scrim" />
    </div>
  )
}
