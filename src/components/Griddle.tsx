export function Griddle() {
  return (
    <div className="griddle" aria-hidden="true" data-testid="griddle">
      <span className="griddle__plate" />
      <span className="griddle__glow" />
      <span className="griddle__embers griddle__embers--left" />
      <span className="griddle__embers griddle__embers--right" />
      <span className="griddle__embers griddle__embers--bottom" />
    </div>
  )
}
