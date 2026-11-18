export const FIRE_PLAYBACK_RATE = 0.5

function keepFireCalm(video: HTMLVideoElement | null) {
  if (!video || video.playbackRate === FIRE_PLAYBACK_RATE) return
  video.playbackRate = FIRE_PLAYBACK_RATE
}

export function FireBackdrop() {
  const base = import.meta.env.BASE_URL
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div className="fire" aria-hidden="true">
      {reduce ? (
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
          preload="auto"
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
