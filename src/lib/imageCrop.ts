import type { ImageCrop, SlideBlock } from '../types'

export interface ImageFrame {
  x: number
  y: number
  w: number
  h: number
}
export interface NaturalImageSize {
  width: number
  height: number
}
type ImageSettings = Pick<NonNullable<SlideBlock['image']>, 'fit' | 'position' | 'crop'>

const bounded = (value: number | undefined, fallback: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value !== undefined && Number.isFinite(value) ? value : fallback))

/** Normalized alignment, independent of the size of the preview or slide. */
export function getImageCrop(image: Pick<ImageSettings, 'position' | 'crop'>): ImageCrop {
  const position = bounded(image.position, 50, 0, 100)
  return {
    x: bounded(image.crop?.x, position, 0, 100),
    y: bounded(image.crop?.y, position, 0, 100),
    zoom: bounded(image.crop?.zoom, 1, 1, 4),
  }
}

/** Shared by the SVG renderer, PDF and crop preview; the embedded source never changes. */
export function resolveImagePlacement(
  image: ImageSettings,
  natural: NaturalImageSize,
  frame: ImageFrame,
): ImageFrame {
  if (
    !(
      natural.width > 0 &&
      natural.height > 0 &&
      Number.isFinite(natural.width) &&
      Number.isFinite(natural.height)
    )
  )
    return { ...frame }
  const contain = image.fit === 'contain'
  const crop = getImageCrop(image)
  const scale = contain
    ? Math.min(frame.w / natural.width, frame.h / natural.height)
    : Math.max(frame.w / natural.width, frame.h / natural.height) * crop.zoom
  const w = natural.width * scale
  const h = natural.height * scale
  return {
    x: frame.x + (frame.w - w) * (contain ? 0.5 : crop.x / 100),
    y: frame.y + (frame.h - h) * (contain ? 0.5 : crop.y / 100),
    w,
    h,
  }
}
