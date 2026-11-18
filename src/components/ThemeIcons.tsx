import type { ReactNode } from 'react'

// Stroke icons from Tabler Icons (MIT), except Rabbit from Lucide (ISC).
// https://github.com/tabler/tabler-icons
// https://github.com/lucide-icons/lucide

type IconProps = {
  fill?: string
  stroke?: string
}

function Icon({ fill = 'none', stroke = 'currentColor', children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export function ChristmasTree() {
  return (
    <Icon>
      <path d="M12 3l4 4l-2 1l4 4l-3 1l4 4h-14l4 -4l-3 -1l4 -4l-2 -1z" />
      <path d="M14 17v3a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-3" />
    </Icon>
  )
}

export function ChristmasBall() {
  return (
    <Icon>
      <path d="M12 13m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0" />
      <path d="M11 5l1 -2l1 2" />
      <path d="M4.512 10.161c2.496 -1.105 4.992 -.825 7.488 .839c2.627 1.752 5.255 1.97 7.882 .653" />
      <path d="M4.315 15.252c2.561 -1.21 5.123 -.96 7.685 .748c2.293 1.528 4.585 1.889 6.878 1.081" />
    </Icon>
  )
}

export function Gift() {
  return (
    <Icon>
      <path d="M3 8m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z" />
      <path d="M12 8l0 13" />
      <path d="M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" />
    </Icon>
  )
}

export function Sparkles() {
  return (
    <Icon>
      <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z" />
    </Icon>
  )
}

export function Confetti() {
  return (
    <Icon>
      <path d="M4 5h2" />
      <path d="M5 4v2" />
      <path d="M11.5 4l-.5 2" />
      <path d="M18 5h2" />
      <path d="M19 4v2" />
      <path d="M15 9l-1 1" />
      <path d="M18 13l2 -.5" />
      <path d="M18 19h2" />
      <path d="M19 18v2" />
      <path d="M14 16.518l-6.518 -6.518l-4.39 9.58a1 1 0 0 0 1.329 1.329l9.579 -4.39z" />
    </Icon>
  )
}

export function TheaterMasks() {
  return (
    <Icon>
      <path d="M13.192 9h6.616a2 2 0 0 1 1.992 2.183l-.567 6.182a4 4 0 0 1 -3.983 3.635h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183z" />
      <path d="M15 13h.01" />
      <path d="M18 13h.01" />
      <path d="M15 16.5c1 .667 2 .667 3 0" />
      <path d="M8.632 15.982a4.037 4.037 0 0 1 -.382 .018h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183h6.616a2 2 0 0 1 2 2" />
      <path d="M6 8h.01" />
      <path d="M9 8h.01" />
      <path d="M6 12c.764 -.51 1.528 -.63 2.291 -.36" />
    </Icon>
  )
}

export function CarnivalFlag() {
  return (
    <Icon fill="currentColor" stroke="none">
      <path d="M5 14h14l-4.5 -4.5l4.5 -4.5h-14v16" />
    </Icon>
  )
}

export function Egg() {
  return (
    <Icon fill="currentColor">
      <path d="M19 14.083c0 4.154 -2.966 6.74 -7 6.917c-4.2 0 -7 -2.763 -7 -6.917c0 -5.538 3.5 -11.09 7 -11.083c3.5 .007 7 5.545 7 11.083z" />
    </Icon>
  )
}

export function Rabbit() {
  return (
    <Icon>
      <path d="M13 16a3 3 0 0 1 2.24 5" />
      <path d="M18 12h.01" />
      <path d="M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1 1 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a2 2 0 0 1-2 2h-1a3 3 0 0 0-3 3" />
      <path d="M20 8.54V4a2 2 0 1 0-4 0v3" />
      <path d="M7.612 12.524a3 3 0 1 0-1.6 4.3" />
    </Icon>
  )
}

export function Pennant() {
  return (
    <Icon fill="currentColor" stroke="currentColor">
      <path d="M14 21v-18" />
      <path d="M14 4l-9 4l9 4z" />
    </Icon>
  )
}
