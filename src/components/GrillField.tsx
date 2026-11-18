const FLAMES = [
  { side: 'left', x: '4%', h: 150, delay: '0s', duration: '3.1s' },
  { side: 'left', x: '11%', h: 110, delay: '0.7s', duration: '3.8s' },
  { side: 'left', x: '18%', h: 170, delay: '1.3s', duration: '3.4s' },
  { side: 'left', x: '25%', h: 90, delay: '0.4s', duration: '4.2s' },
  { side: 'right', x: '75%', h: 100, delay: '0.9s', duration: '3.6s' },
  { side: 'right', x: '82%', h: 160, delay: '0.2s', duration: '3.3s' },
  { side: 'right', x: '89%', h: 120, delay: '1.1s', duration: '4s' },
  { side: 'right', x: '96%', h: 145, delay: '0.5s', duration: '3.5s' },
] as const

const EMBERS = [
  { x: '7%', delay: '0s', duration: '4.6s' },
  { x: '15%', delay: '1.4s', duration: '5.2s' },
  { x: '22%', delay: '0.6s', duration: '4.2s' },
  { x: '78%', delay: '0.3s', duration: '5s' },
  { x: '86%', delay: '1.8s', duration: '4.4s' },
  { x: '94%', delay: '0.9s', duration: '5.4s' },
] as const

export function GrillField() {
  return (
    <div className="grill" aria-hidden="true">
      <svg className="grill__grate" viewBox="0 0 1200 900" preserveAspectRatio="none">
        {Array.from({ length: 16 }, (_, index) => (
          <line key={index} x1="0" x2="1200" y1={28 + index * 56} y2={28 + index * 56} />
        ))}
      </svg>
      <div className="grill__heat" />
      {FLAMES.map((flame) => (
        <span
          key={`${flame.side}-${flame.x}`}
          className={`grill__flame grill__flame--${flame.side}`}
          style={{
            left: flame.x,
            height: flame.h,
            animationDelay: flame.delay,
            animationDuration: flame.duration,
          }}
        />
      ))}
      {EMBERS.map((ember) => (
        <span
          key={ember.x}
          className="grill__ember"
          style={{
            left: ember.x,
            animationDelay: ember.delay,
            animationDuration: ember.duration,
          }}
        />
      ))}
      <span className="grill__patty grill__patty--left" />
      <span className="grill__patty grill__patty--right" />
      <div className="grill__scrim" />
    </div>
  )
}
