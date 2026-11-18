import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { applyDocumentTheme, ThemeContext, useAppliedTheme, useTheme, type ThemeId } from '../lib/theme'
import { juneFlags, themeIcons, ThemeIcon } from './ThemeIcons'

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

const CONFETTI: Array<Piece & { icon: string }> = [
  { x: '8vw', size: '28px', dur: '7s', delay: '0s', opacity: '0.95', drift: '18px', icon: themeIcons.confettiBall },
  { x: '24vw', size: '26px', dur: '8.5s', delay: '-2s', opacity: '0.9', drift: '-14px', icon: themeIcons.balloon },
  { x: '41vw', size: '24px', dur: '6.5s', delay: '-4s', opacity: '0.95', drift: '22px', icon: themeIcons.partyPopper },
  { x: '58vw', size: '26px', dur: '9s', delay: '-1s', opacity: '0.9', drift: '-18px', icon: themeIcons.umbrella },
  { x: '74vw', size: '28px', dur: '7.5s', delay: '-3.5s', opacity: '0.95', drift: '12px', icon: themeIcons.drum },
  { x: '90vw', size: '24px', dur: '8s', delay: '-5s', opacity: '0.9', drift: '-10px', icon: themeIcons.confettiBall },
]

const SPARKS: Array<Piece & { icon: string }> = [
  { x: '10vw', size: '26px', dur: '6s', delay: '0s', opacity: '0.95', drift: '16px', icon: themeIcons.fireworks },
  { x: '30vw', size: '22px', dur: '7.5s', delay: '-2s', opacity: '0.85', drift: '-12px', icon: themeIcons.sparkles },
  { x: '55vw', size: '28px', dur: '5.5s', delay: '-3s', opacity: '0.95', drift: '20px', icon: themeIcons.partyPopper },
  { x: '78vw', size: '24px', dur: '8s', delay: '-1s', opacity: '0.9', drift: '-16px', icon: themeIcons.star },
]

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

function Falling({ pieces, mark }: { pieces: Array<Piece & { icon: string }>; mark: string }) {
  return (
    <div className="theme-fall" {...{ [mark]: '' }}>
      {pieces.map((piece, index) => (
        <span key={index} className="theme-piece" style={pieceStyle(piece)}>
          <ThemeIcon src={piece.icon} />
        </span>
      ))}
    </div>
  )
}

export function ThemeBackdrop({ theme }: { theme: ThemeId }) {
  if (theme === 'atual') return null
  return <div className={`theme-bg theme-bg--${theme}`} data-theme-bg={theme} aria-hidden="true" />
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
            <ThemeIcon src={themeIcons.christmasTree} />
          </div>
          <div className="theme-ornament theme-ornament--ball" data-theme-ball="">
            <ThemeIcon src={themeIcons.snowman} />
          </div>
          <div className="theme-ornament theme-ornament--gift">
            <ThemeIcon src={themeIcons.wrappedGift} />
          </div>
        </>
      ) : null}
      {theme === 'ano-novo' ? (
        <>
          <Falling pieces={SPARKS} mark="data-theme-sparks" />
          <div className="theme-year" data-theme-year="">
            <ThemeIcon src={themeIcons.fireworks} />
            <span>{celebrationYear()}</span>
          </div>
        </>
      ) : null}
      {theme === 'carnaval' ? (
        <>
          <Falling pieces={CONFETTI} mark="data-theme-confetti" />
          <div className="theme-ornament theme-ornament--mask" data-theme-mask="">
            <ThemeIcon src={themeIcons.performingArts} />
          </div>
          <div className="theme-ornament theme-ornament--flag" data-theme-flag="">
            <ThemeIcon src={themeIcons.umbrella} />
          </div>
        </>
      ) : null}
      {theme === 'pascoa' ? (
        <>
          <div className="theme-ornament theme-ornament--egg" data-theme-egg="">
            <ThemeIcon src={themeIcons.egg} />
          </div>
          <div className="theme-ornament theme-ornament--egg theme-ornament--egg-b">
            <ThemeIcon src={themeIcons.egg} />
          </div>
          <div className="theme-ornament theme-ornament--bunny" data-theme-bunny="">
            <ThemeIcon src={themeIcons.rabbit} />
          </div>
        </>
      ) : null}
      {theme === 'sao-joao' ? (
        <>
          <div className="theme-flags" data-theme-flags="">
            {juneFlags.map((src, index) => (
              <span key={index}>
                <ThemeIcon src={src} />
              </span>
            ))}
          </div>
          <div className="theme-ornament theme-ornament--fire" data-theme-fire="">
            <ThemeIcon src={themeIcons.fire} />
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
      {admin ? null : <ThemeBackdrop theme={theme} />}
      {admin ? null : <ThemeDecor theme={theme} />}
      {children}
    </>
  )
}

export function ThemeFrame({ children }: { children: ReactNode }) {
  const theme = useAppliedTheme()
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}
