import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { applyDocumentTheme, ThemeContext, useAppliedTheme, useTheme, type ThemeId } from '../lib/theme'
import {
  CarnivalFlag,
  ChristmasBall,
  ChristmasTree,
  Confetti,
  Egg,
  Gift,
  Pennant,
  Rabbit,
  Sparkles,
  TheaterMasks,
} from './ThemeIcons'

type Piece = {
  x: string
  size: string
  dur: string
  delay: string
  opacity: string
  drift: string
  color?: string
}

const THIN_FLAKES: Piece[] = [
  { x: '6vw', size: '8px', dur: '11s', delay: '0s', opacity: '0.28', drift: '14px' },
  { x: '18vw', size: '10px', dur: '13s', delay: '-2s', opacity: '0.34', drift: '-10px' },
  { x: '34vw', size: '7px', dur: '9.5s', delay: '-4s', opacity: '0.22', drift: '18px' },
  { x: '52vw', size: '9px', dur: '12s', delay: '-1s', opacity: '0.3', drift: '-16px' },
  { x: '71vw', size: '8px', dur: '10s', delay: '-6s', opacity: '0.26', drift: '12px' },
  { x: '88vw', size: '11px', dur: '14s', delay: '-3s', opacity: '0.32', drift: '-8px' },
]

const LARGE_FLAKES: Piece[] = [
  { x: '12vw', size: '22px', dur: '8s', delay: '-1.5s', opacity: '0.82', drift: '20px' },
  { x: '40vw', size: '26px', dur: '9s', delay: '-5s', opacity: '0.9', drift: '-22px' },
  { x: '63vw', size: '20px', dur: '7.5s', delay: '0s', opacity: '0.75', drift: '16px' },
  { x: '81vw', size: '24px', dur: '10s', delay: '-3.5s', opacity: '0.88', drift: '-14px' },
  { x: '27vw', size: '21px', dur: '8.5s', delay: '-7s', opacity: '0.7', drift: '10px' },
]

const CONFETTI: Piece[] = [
  { x: '8vw', size: '22px', dur: '7s', delay: '0s', opacity: '0.9', drift: '18px', color: '#ffd23f' },
  { x: '24vw', size: '16px', dur: '8.5s', delay: '-2s', opacity: '0.85', drift: '-14px', color: '#c46bff' },
  { x: '41vw', size: '20px', dur: '6.5s', delay: '-4s', opacity: '0.9', drift: '22px', color: '#3dbe6a' },
  { x: '58vw', size: '18px', dur: '9s', delay: '-1s', opacity: '0.8', drift: '-18px', color: '#ff4d6d' },
  { x: '74vw', size: '22px', dur: '7.5s', delay: '-3.5s', opacity: '0.9', drift: '12px', color: '#4cc9f0' },
  { x: '90vw', size: '16px', dur: '8s', delay: '-5s', opacity: '0.85', drift: '-10px', color: '#ffd23f' },
]

const SPARKS: Piece[] = [
  { x: '10vw', size: '18px', dur: '6s', delay: '0s', opacity: '0.9', drift: '16px', color: '#f6e7a1' },
  { x: '30vw', size: '14px', dur: '7.5s', delay: '-2s', opacity: '0.75', drift: '-12px', color: '#8fd3ff' },
  { x: '55vw', size: '20px', dur: '5.5s', delay: '-3s', opacity: '0.95', drift: '20px', color: '#fff6c8' },
  { x: '78vw', size: '16px', dur: '8s', delay: '-1s', opacity: '0.8', drift: '-16px', color: '#f6e7a1' },
]

const FLAG_COLORS = ['#e23b3b', '#ffcc33', '#2f9e44', '#3b82f6', '#ff6a00', '#f2d27a', '#c46bff', '#e23b3b']

function pieceStyle(piece: Piece): CSSProperties {
  return {
    ['--x' as string]: piece.x,
    ['--size' as string]: piece.size,
    ['--dur' as string]: piece.dur,
    ['--delay' as string]: piece.delay,
    ['--opacity' as string]: piece.opacity,
    ['--drift' as string]: piece.drift,
    ['--piece' as string]: piece.color,
  }
}

function Snow() {
  return (
    <div className="theme-snow" data-theme-snow="">
      {THIN_FLAKES.map((flake, index) => (
        <span key={`thin-${index}`} className="theme-snow__flake theme-snow__flake--thin" style={pieceStyle(flake)}>
          ❄
        </span>
      ))}
      {LARGE_FLAKES.map((flake, index) => (
        <span key={`large-${index}`} className="theme-snow__flake theme-snow__flake--large" style={pieceStyle(flake)}>
          ❄
        </span>
      ))}
    </div>
  )
}

function Falling({ pieces, mark, icon }: { pieces: Piece[]; mark: string; icon: 'confetti' | 'sparkles' }) {
  return (
    <div className="theme-fall" {...{ [mark]: '' }}>
      {pieces.map((piece, index) => (
        <span key={index} className="theme-piece" style={pieceStyle(piece)}>
          {icon === 'confetti' ? <Confetti /> : <Sparkles />}
        </span>
      ))}
    </div>
  )
}

function celebrationYear(now = new Date()) {
  return now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
}

export function ThemeDecor({ theme }: { theme: ThemeId }) {
  if (theme === 'atual') return null

  return (
    <div className="theme-decor" data-theme-ornament={theme} aria-hidden="true">
      {theme === 'natal' ? (
        <>
          <Snow />
          <div className="theme-ornament theme-ornament--tree" data-theme-tree="">
            <ChristmasTree />
          </div>
          <div className="theme-ornament theme-ornament--ball" data-theme-ball="">
            <ChristmasBall />
          </div>
          <div className="theme-ornament theme-ornament--gift">
            <Gift />
          </div>
        </>
      ) : null}
      {theme === 'ano-novo' ? (
        <>
          <Falling pieces={SPARKS} mark="data-theme-sparks" icon="sparkles" />
          <div className="theme-year" data-theme-year="">
            <Sparkles />
            <span>{celebrationYear()}</span>
          </div>
        </>
      ) : null}
      {theme === 'carnaval' ? (
        <>
          <Falling pieces={CONFETTI} mark="data-theme-confetti" icon="confetti" />
          <div className="theme-ornament theme-ornament--mask" data-theme-mask="">
            <TheaterMasks />
          </div>
          <div className="theme-ornament theme-ornament--flag" data-theme-flag="">
            <CarnivalFlag />
          </div>
        </>
      ) : null}
      {theme === 'pascoa' ? (
        <>
          <div className="theme-ornament theme-ornament--egg" data-theme-egg="">
            <Egg />
          </div>
          <div className="theme-ornament theme-ornament--egg theme-ornament--egg-b">
            <Egg />
          </div>
          <div className="theme-ornament theme-ornament--bunny" data-theme-bunny="">
            <Rabbit />
          </div>
        </>
      ) : null}
      {theme === 'sao-joao' ? (
        <>
          <div className="theme-flags" data-theme-flags="">
            {FLAG_COLORS.map((color, index) => (
              <span key={index} style={{ color }}>
                <Pennant />
              </span>
            ))}
          </div>
          <div className="theme-glow" data-theme-glow="" />
        </>
      ) : null}
    </div>
  )
}

export function CustomerTheme({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const { pathname } = useLocation()
  const admin = pathname === '/admin' || pathname.startsWith('/admin/')

  useEffect(() => {
    applyDocumentTheme(admin ? null : theme)
  }, [admin, theme])

  return (
    <>
      {admin ? null : <ThemeDecor theme={theme} />}
      {children}
    </>
  )
}

export function ThemeFrame({ children }: { children: ReactNode }) {
  const theme = useAppliedTheme()
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}
