import accordion from '../assets/theme/accordion.svg'
import balloon from '../assets/theme/balloon.svg'
import basket from '../assets/theme/basket.svg'
import bell from '../assets/theme/bell.svg'
import blossom from '../assets/theme/blossom.svg'
import butterfly from '../assets/theme/butterfly.svg'
import candy from '../assets/theme/candy.svg'
import carrot from '../assets/theme/carrot.svg'
import chick from '../assets/theme/chick.svg'
import chocolate from '../assets/theme/chocolate.svg'
import christmasTree from '../assets/theme/christmas-tree.svg'
import confettiBall from '../assets/theme/confetti-ball.svg'
import cork from '../assets/theme/cork.svg'
import corn from '../assets/theme/corn.svg'
import dancer from '../assets/theme/dancer.svg'
import drum from '../assets/theme/drum.svg'
import egg from '../assets/theme/egg.svg'
import fire from '../assets/theme/fire.svg'
import fireworks from '../assets/theme/fireworks.svg'
import flagYellow from '../assets/theme/flag-yellow.svg'
import glasses from '../assets/theme/glasses.svg'
import hatching from '../assets/theme/hatching.svg'
import lantern from '../assets/theme/lantern.svg'
import maracas from '../assets/theme/maracas.svg'
import mirrorBall from '../assets/theme/mirror-ball.svg'
import notes from '../assets/theme/notes.svg'
import parrot from '../assets/theme/parrot.svg'
import partyPopper from '../assets/theme/party-popper.svg'
import partying from '../assets/theme/partying.svg'
import pepper from '../assets/theme/pepper.svg'
import performingArts from '../assets/theme/performing-arts.svg'
import pine from '../assets/theme/pine.svg'
import popcorn from '../assets/theme/popcorn.svg'
import rabbit from '../assets/theme/rabbit.svg'
import rabbitFace from '../assets/theme/rabbit-face.svg'
import ribbon from '../assets/theme/ribbon.svg'
import santa from '../assets/theme/santa.svg'
import saxophone from '../assets/theme/saxophone.svg'
import shootingStar from '../assets/theme/shooting-star.svg'
import snowflake from '../assets/theme/snowflake.svg'
import snowman from '../assets/theme/snowman.svg'
import sparkler from '../assets/theme/sparkler.svg'
import sparkles from '../assets/theme/sparkles.svg'
import star from '../assets/theme/star.svg'
import tulip from '../assets/theme/tulip.svg'
import umbrella from '../assets/theme/umbrella.svg'
import wrappedGift from '../assets/theme/wrapped-gift.svg'

// Color artwork: Fluent Emoji (MIT), Microsoft.
// Flaticon free icons are not embedded: that license does not allow distributing the files.

export const themeIcons = {
  accordion,
  balloon,
  basket,
  bell,
  blossom,
  butterfly,
  candy,
  carrot,
  chick,
  chocolate,
  christmasTree,
  confettiBall,
  cork,
  corn,
  dancer,
  drum,
  egg,
  fire,
  fireworks,
  flagYellow,
  glasses,
  hatching,
  lantern,
  maracas,
  mirrorBall,
  notes,
  parrot,
  partyPopper,
  partying,
  pepper,
  performingArts,
  pine,
  popcorn,
  rabbit,
  rabbitFace,
  ribbon,
  santa,
  saxophone,
  shootingStar,
  snowflake,
  snowman,
  sparkler,
  sparkles,
  star,
  tulip,
  umbrella,
  wrappedGift,
}

export function ThemeIcon({ src }: { src: string }) {
  return <img src={src} alt="" draggable={false} />
}
