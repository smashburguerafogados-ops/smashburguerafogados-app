import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { applyDocumentTheme, ThemeContext, useAppliedTheme, useTheme, type ThemeId } from '../lib/theme'
import { RaffleMark } from './RaffleMark'
import { themeIcons, ThemeIcon } from './ThemeIcons'

type Piece = {
  x: string
  size: string
  dur: string
  delay: string
  opacity: string
  drift: string
  color?: string
}

type IconPiece = Piece & { icon: string; kind: string }

type Pin = {
  icon: string
  kind: string
  slot: string
  splash?: boolean
  attrs?: Record<string, string>
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

function half<T>(items: T[]): T[] {
  return items.filter((_, index) => index % 2 === 0)
}

function scatter(icons: Array<{ icon: string; kind: string }>): IconPiece[] {
  return half(icons.flatMap((item, index) => {
    const size = 18 + ((index * 7) % 24)
    return [
      {
        ...item,
        x: `${(index * 13) % 84 + 6}vw`,
        size: `${size}px`,
        dur: `${8 + (index % 5)}s`,
        delay: `${-(index % 7)}s`,
        opacity: '0.95',
        drift: `${index % 2 ? 18 : -16}px`,
      },
      {
        ...item,
        x: `${(index * 13 + 41) % 84 + 6}vw`,
        size: `${Math.max(12, size - 10)}px`,
        dur: `${11 + (index % 4)}s`,
        delay: `${-(index % 5) - 2.4}s`,
        opacity: '0.78',
        drift: `${index % 2 ? -12 : 20}px`,
      },
    ]
  }))
}

const NATAL_FALL = scatter([
  { icon: themeIcons.snowflake, kind: 'snowflake' },
  { icon: themeIcons.christmasTree, kind: 'tree' },
  { icon: themeIcons.wrappedGift, kind: 'gift' },
  { icon: themeIcons.bell, kind: 'bell' },
  { icon: themeIcons.candy, kind: 'candy' },
  { icon: themeIcons.santa, kind: 'santa' },
  { icon: themeIcons.pine, kind: 'pine' },
  { icon: themeIcons.star, kind: 'star' },
])

const YEAR_FALL = scatter([
  { icon: themeIcons.fireworks, kind: 'fireworks' },
  { icon: themeIcons.sparkler, kind: 'sparkler' },
  { icon: themeIcons.sparkles, kind: 'sparkles' },
  { icon: themeIcons.partyPopper, kind: 'popper' },
  { icon: themeIcons.confettiBall, kind: 'confetti' },
  { icon: themeIcons.star, kind: 'star' },
  { icon: themeIcons.balloon, kind: 'balloon' },
  { icon: themeIcons.mirrorBall, kind: 'mirror' },
])

const CARNIVAL_FALL = scatter([
  { icon: themeIcons.confettiBall, kind: 'confetti' },
  { icon: themeIcons.balloon, kind: 'balloon' },
  { icon: themeIcons.notes, kind: 'notes' },
  { icon: themeIcons.parrot, kind: 'parrot' },
  { icon: themeIcons.partyPopper, kind: 'popper' },
  { icon: themeIcons.drum, kind: 'drum' },
  { icon: themeIcons.mirrorBall, kind: 'mirror' },
  { icon: themeIcons.maracas, kind: 'maracas' },
])

const EASTER_FALL = scatter([
  { icon: themeIcons.egg, kind: 'egg' },
  { icon: themeIcons.rabbit, kind: 'rabbit' },
  { icon: themeIcons.chick, kind: 'chick' },
  { icon: themeIcons.hatching, kind: 'hatching' },
  { icon: themeIcons.blossom, kind: 'blossom' },
  { icon: themeIcons.carrot, kind: 'carrot' },
  { icon: themeIcons.butterfly, kind: 'butterfly' },
  { icon: themeIcons.chocolate, kind: 'chocolate' },
])

const JUNE_FALL = scatter([
  { icon: themeIcons.corn, kind: 'corn' },
  { icon: themeIcons.popcorn, kind: 'popcorn' },
  { icon: themeIcons.pepper, kind: 'pepper' },
  { icon: themeIcons.balloon, kind: 'balloon' },
  { icon: themeIcons.lantern, kind: 'lantern' },
  { icon: themeIcons.star, kind: 'star' },
  { icon: themeIcons.accordion, kind: 'accordion' },
  { icon: themeIcons.fire, kind: 'fire' },
])

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
      {half(THIN_FLAKES).map((flake, index) => (
        <span
          key={`thin-${index}`}
          className="theme-snow__flake theme-snow__flake--thin"
          data-fall-kind="flake"
          style={pieceStyle(flake)}
        >
          ❄
        </span>
      ))}
      {half(LARGE_FLAKES).map((flake, index) => (
        <span
          key={`large-${index}`}
          className="theme-snow__flake theme-snow__flake--large"
          data-fall-kind="flake"
          style={pieceStyle(flake)}
        >
          ❄
        </span>
      ))}
    </div>
  )
}

function Falling({ pieces, mark }: { pieces: IconPiece[]; mark: string }) {
  return (
    <div className="theme-fall" {...{ [mark]: '' }}>
      {pieces.map((piece, index) => (
        <span key={index} className="theme-piece" data-fall-kind={piece.kind} style={pieceStyle(piece)}>
          <ThemeIcon src={piece.icon} />
        </span>
      ))}
    </div>
  )
}

function Pins({ pins }: { pins: Pin[] }) {
  return pins.map((pin) => (
    <div
      key={`${pin.slot}-${pin.kind}`}
      className={`theme-pin theme-pin--${pin.slot} ${pin.splash ? 'theme-pin--splash' : 'theme-pin--menu'}`}
      data-theme-pin={pin.kind}
      {...pin.attrs}
    >
      <ThemeIcon src={pin.icon} />
    </div>
  ))
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
          <Falling pieces={NATAL_FALL} mark="data-theme-fall" />
          <Pins
            pins={[
              { icon: themeIcons.christmasTree, kind: 'tree', slot: 'l1', attrs: { 'data-theme-tree': '' } },
              { icon: themeIcons.snowman, kind: 'snowman', slot: 'l2', attrs: { 'data-theme-ball': '' } },
              { icon: themeIcons.candy, kind: 'candy', slot: 'l3' },
              { icon: themeIcons.wrappedGift, kind: 'gift', slot: 'r1' },
              { icon: themeIcons.bell, kind: 'bell', slot: 'r2' },
              { icon: themeIcons.pine, kind: 'pine', slot: 'r3' },
              { icon: themeIcons.santa, kind: 'santa', slot: 'stl', splash: true },
              { icon: themeIcons.ribbon, kind: 'ribbon', slot: 'str', splash: true },
              { icon: themeIcons.star, kind: 'star', slot: 'sbl', splash: true },
              { icon: themeIcons.snowflake, kind: 'snowflake', slot: 'sbr', splash: true },
            ]}
          />
        </>
      ) : null}
      {theme === 'ano-novo' ? (
        <>
          <Falling pieces={YEAR_FALL} mark="data-theme-sparks" />
          <div className="theme-year" data-theme-year="">
            <ThemeIcon src={themeIcons.fireworks} />
            <span>{celebrationYear()}</span>
          </div>
          <Pins
            pins={[
              { icon: themeIcons.glasses, kind: 'glasses', slot: 'l1' },
              { icon: themeIcons.cork, kind: 'cork', slot: 'l2' },
              { icon: themeIcons.partying, kind: 'partying', slot: 'l3' },
              { icon: themeIcons.sparkler, kind: 'sparkler', slot: 'r2' },
              { icon: themeIcons.mirrorBall, kind: 'mirror', slot: 'r3' },
              { icon: themeIcons.partyPopper, kind: 'popper', slot: 'stl', splash: true },
              { icon: themeIcons.balloon, kind: 'balloon', slot: 'str', splash: true },
              { icon: themeIcons.confettiBall, kind: 'confetti', slot: 'sbl', splash: true },
              { icon: themeIcons.shootingStar, kind: 'shooting', slot: 'sbr', splash: true },
            ]}
          />
        </>
      ) : null}
      {theme === 'carnaval' ? (
        <>
          <Falling pieces={CARNIVAL_FALL} mark="data-theme-confetti" />
          <Pins
            pins={[
              { icon: themeIcons.performingArts, kind: 'mask', slot: 'l1', attrs: { 'data-theme-mask': '' } },
              { icon: themeIcons.dancer, kind: 'dancer', slot: 'l2' },
              { icon: themeIcons.maracas, kind: 'maracas', slot: 'l3' },
              { icon: themeIcons.flagYellow, kind: 'flag', slot: 'r1', attrs: { 'data-theme-flag': '' } },
              { icon: themeIcons.saxophone, kind: 'saxophone', slot: 'r2' },
              { icon: themeIcons.parrot, kind: 'parrot', slot: 'r3' },
              { icon: themeIcons.drum, kind: 'drum', slot: 'stl', splash: true },
              { icon: themeIcons.umbrella, kind: 'umbrella', slot: 'str', splash: true },
              { icon: themeIcons.notes, kind: 'notes', slot: 'sbl', splash: true },
              { icon: themeIcons.mirrorBall, kind: 'mirror', slot: 'sbr', splash: true },
            ]}
          />
        </>
      ) : null}
      {theme === 'pascoa' ? (
        <>
          <Falling pieces={EASTER_FALL} mark="data-theme-fall" />
          <Pins
            pins={[
              { icon: themeIcons.egg, kind: 'egg', slot: 'l1', attrs: { 'data-theme-egg': '' } },
              { icon: themeIcons.chick, kind: 'chick', slot: 'l2' },
              { icon: themeIcons.tulip, kind: 'tulip', slot: 'l3' },
              { icon: themeIcons.rabbit, kind: 'rabbit', slot: 'r1', attrs: { 'data-theme-bunny': '' } },
              { icon: themeIcons.butterfly, kind: 'butterfly', slot: 'r2' },
              { icon: themeIcons.basket, kind: 'basket', slot: 'r3' },
              { icon: themeIcons.hatching, kind: 'hatching', slot: 'stl', splash: true },
              { icon: themeIcons.rabbitFace, kind: 'rabbit-face', slot: 'str', splash: true },
              { icon: themeIcons.blossom, kind: 'blossom', slot: 'sbl', splash: true },
              { icon: themeIcons.carrot, kind: 'carrot', slot: 'sbr', splash: true },
            ]}
          />
        </>
      ) : null}
      {theme === 'sao-joao' ? (
        <>
          <Falling pieces={JUNE_FALL} mark="data-theme-fall" />
          <Pins
            pins={[
              { icon: themeIcons.fire, kind: 'fire', slot: 'r1', attrs: { 'data-theme-fire': '' } },
              { icon: themeIcons.accordion, kind: 'accordion', slot: 'r2' },
              { icon: themeIcons.lantern, kind: 'lantern', slot: 'r3', attrs: { 'data-theme-glow': '' } },
              { icon: themeIcons.corn, kind: 'corn', slot: 'stl', splash: true },
              { icon: themeIcons.popcorn, kind: 'popcorn', slot: 'str', splash: true },
              { icon: themeIcons.pepper, kind: 'pepper', slot: 'sbl', splash: true },
              { icon: themeIcons.balloon, kind: 'balloon', slot: 'sbr', splash: true },
            ]}
          />
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
      {admin ? null : <RaffleMark />}
      {children}
    </>
  )
}

export function ThemeFrame({ children }: { children: ReactNode }) {
  const theme = useAppliedTheme()
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}
