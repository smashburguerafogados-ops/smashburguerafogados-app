const MAX_SIDE = 640
const QUALITY = 0.72
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

/** Returns a JPEG data URL small enough to live on the product document. */
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
    const compressed = canvas.toDataURL('image/jpeg', QUALITY)
    if (compressed.length <= MAX_PHOTO_CHARS) return compressed
  } catch {
    // Fall through to the original when the browser cannot redraw it.
  }
  if (original.length <= MAX_PHOTO_CHARS) return original
  throw new Error('A foto é muito grande. Tente outra.')
}
