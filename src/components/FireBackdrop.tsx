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
        />
      )}
      <div className="fire__scrim" />
    </div>
  )
}
