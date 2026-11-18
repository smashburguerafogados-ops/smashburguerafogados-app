import type { ReactNode } from 'react'

type StatusScreenProps = {
  title: string
  children?: ReactNode
}

export function StatusScreen({ title, children }: StatusScreenProps) {
  return (
    <div className="stage">
      <section className="card card--narrow">
        <h1>{title}</h1>
        {children}
      </section>
    </div>
  )
}
