import type { ReactNode } from 'react'

type MarkProps = { className?: string }

function Mark({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function BackIcon() {
  return (
    <Mark>
      <path d="M14.5 6.5 8.5 12l6 5.5" {...stroke} />
    </Mark>
  )
}

export function PhoneIcon({ className }: MarkProps) {
  return (
    <Mark className={className}>
      <path d="M8.2 4.8h2.2l1.1 2.6-1.5 1a11 11 0 0 0 5.6 5.6l1-1.5 2.6 1.1v2.2a1.6 1.6 0 0 1-1.7 1.6A14.2 14.2 0 0 1 6.6 6.5a1.6 1.6 0 0 1 1.6-1.7Z" {...stroke} />
    </Mark>
  )
}

export function SearchIcon({ className }: MarkProps) {
  return (
    <Mark className={className}>
      <circle cx="11" cy="11" r="6" {...stroke} />
      <path d="m15.6 15.6 3.6 3.6" {...stroke} />
    </Mark>
  )
}

export function PinIcon() {
  return (
    <Mark>
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" {...stroke} />
      <circle cx="12" cy="11" r="2" {...stroke} />
    </Mark>
  )
}

export function BuildingIcon() {
  return (
    <Mark>
      <path d="M5 20.5V6.5L12 3.5l7 3v14" {...stroke} />
      <path d="M9 20.5v-5h6v5M9 9.5h.01M12 9.5h.01M15 9.5h.01M9 13h.01M12 13h.01M15 13h.01" {...stroke} />
    </Mark>
  )
}

export function CardIcon() {
  return (
    <Mark>
      <rect x="4" y="6" width="16" height="12" rx="2" {...stroke} />
      <path d="M8 10.5h5M8 14h8" {...stroke} />
    </Mark>
  )
}

export function TruckIcon() {
  return (
    <Mark>
      <path d="M3.5 7.5h10v8h-10zM13.5 11h3.2L19.5 14v1.5h-6" {...stroke} />
      <circle cx="7" cy="17.8" r="1.4" {...stroke} />
      <circle cx="16.2" cy="17.8" r="1.4" {...stroke} />
    </Mark>
  )
}

export function BagIcon() {
  return (
    <Mark>
      <path d="M7 8.5h10l-.8 11H7.8L7 8.5Z" {...stroke} />
      <path d="M9.5 8.5V7a2.5 2.5 0 0 1 5 0v1.5" {...stroke} />
    </Mark>
  )
}

export function HandIcon() {
  return (
    <Mark>
      <path d="M9 11.5V6.8a1.3 1.3 0 0 1 2.6 0V11M11.6 10.2V5.8a1.3 1.3 0 0 1 2.6 0v5.2M14.2 10.6V7.4a1.3 1.3 0 0 1 2.6 0v6.2c0 3-1.6 5.2-4.4 5.2-2.2 0-3.6-1.1-4.4-2.6L6.4 13a1.4 1.4 0 0 1 2.4-1.4L9 12.5" {...stroke} />
    </Mark>
  )
}

export function SaveIcon() {
  return (
    <Mark>
      <path d="M6 4.5h9.2L19.5 8.8V19.5H6V4.5Z" {...stroke} />
      <path d="M8.5 4.5V9h6.5V4.5M8.5 19.5v-5h7v5" {...stroke} />
    </Mark>
  )
}

export function PencilIcon() {
  return (
    <Mark>
      <path d="M14.2 5.2 18.8 9.8 9 19.5H4.5V15L14.2 5.2Z" {...stroke} />
    </Mark>
  )
}

export function TrashIcon() {
  return (
    <Mark>
      <path d="M4.5 7h15M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7" {...stroke} />
      <path d="M6.5 7l.8 11.6c.1.9.8 1.4 1.6 1.4h6.2c.8 0 1.5-.5 1.6-1.4L17.5 7" {...stroke} />
      <path d="M10 10.8v5.4M14 10.8v5.4" {...stroke} />
    </Mark>
  )
}

export function FindMark() {
  return (
    <span className="field__find" aria-hidden="true">
      <SearchIcon />
    </span>
  )
}
