import balloon from '../assets/theme/balloon.svg'
import christmasTree from '../assets/theme/christmas-tree.svg'
import confettiBall from '../assets/theme/confetti-ball.svg'
import drum from '../assets/theme/drum.svg'
import egg from '../assets/theme/egg.svg'
import fire from '../assets/theme/fire.svg'
import fireworks from '../assets/theme/fireworks.svg'
import flagBlue from '../assets/theme/flag-blue.svg'
import flagGreen from '../assets/theme/flag-green.svg'
import flagOrange from '../assets/theme/flag-orange.svg'
import flagRed from '../assets/theme/flag-red.svg'
import flagYellow from '../assets/theme/flag-yellow.svg'
import partyPopper from '../assets/theme/party-popper.svg'
import performingArts from '../assets/theme/performing-arts.svg'
import rabbit from '../assets/theme/rabbit.svg'
import snowman from '../assets/theme/snowman.svg'
import sparkles from '../assets/theme/sparkles.svg'
import star from '../assets/theme/star.svg'
import umbrella from '../assets/theme/umbrella.svg'
import wrappedGift from '../assets/theme/wrapped-gift.svg'

// Color artwork: Fluent Emoji (MIT), Microsoft.
// Flaticon free icons are not embedded: that license does not allow distributing the files.

export const themeIcons = {
  balloon,
  christmasTree,
  confettiBall,
  drum,
  egg,
  fire,
  fireworks,
  flagBlue,
  flagGreen,
  flagOrange,
  flagRed,
  flagYellow,
  partyPopper,
  performingArts,
  rabbit,
  snowman,
  sparkles,
  star,
  umbrella,
  wrappedGift,
}

export const juneFlags = [flagRed, flagYellow, flagGreen, flagBlue, flagOrange, flagRed, flagYellow, flagGreen]

export function ThemeIcon({ src }: { src: string }) {
  return <img src={src} alt="" draggable={false} />
}
