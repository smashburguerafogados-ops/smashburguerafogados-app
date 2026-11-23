// Cards show the photo at ~180 CSS px and the zoom at up to 720, so 560 keeps
// it sharp while a menu photo stays around 20 KB instead of ~70 KB.
export const MAX_SIDE = 560
const WEBP_QUALITY = 0.72
const JPEG_QUALITY = 0.7
// Firestore documents cap at 1 MiB; leave room for the rest of the product.
export const MAX_PHOTO_CHARS = 700_000

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível abrir a foto.'))
    image.src = src
  })
}

/** WebP where the browser can encode it (Chrome, Firefox, Safari 17+), JPEG otherwise. */
export function encodeCanvas(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', WEBP_QUALITY)
  if (webp.startsWith('data:image/webp')) return webp
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

/** Returns a WebP or JPEG data URL small enough to live on a Firestore document. */
export async function readPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem.')
  const original = await readAsDataUrl(file)
  try {
    const image = await loadImage(original)
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const compressed = encodeCanvas(canvas)
    if (compressed.length <= MAX_PHOTO_CHARS) return compressed
  } catch {
    // Fall through to the original when the browser cannot redraw it.
  }
  if (original.length <= MAX_PHOTO_CHARS) return original
  throw new Error('A foto é muito grande. Tente outra.')
}
