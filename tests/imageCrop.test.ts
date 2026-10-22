import { describe, expect, it } from 'vitest'
import { getImageCrop, resolveImagePlacement } from '../src/lib/imageCrop'

describe('non-destructive image placement', () => {
  it('preserves the legacy alignment when no two-dimensional crop is present', () => {
    expect(getImageCrop({ position: 0 })).toEqual({ x: 0, y: 0, zoom: 1 })
    expect(getImageCrop({ position: 80 })).toEqual({ x: 80, y: 80, zoom: 1 })
    expect(
      resolveImagePlacement(
        { fit: 'cover', position: 100 },
        { width: 200, height: 100 },
        { x: 10, y: 20, w: 100, h: 100 },
      ),
    ).toEqual({ x: -90, y: 20, w: 200, h: 100 })
  })

  it('moves both axes independently and never exposes an empty area in cover mode', () => {
    const frame = { x: 100, y: 200, w: 160, h: 90 }
    for (const x of [0, 25, 100])
      for (const y of [0, 70, 100]) {
        const placement = resolveImagePlacement(
          { fit: 'cover', position: 50, crop: { x, y, zoom: 2 } },
          { width: 200, height: 300 },
          frame,
        )
        expect(placement.x).toBeLessThanOrEqual(frame.x)
        expect(placement.y).toBeLessThanOrEqual(frame.y)
        expect(placement.x + placement.w).toBeGreaterThanOrEqual(frame.x + frame.w)
        expect(placement.y + placement.h).toBeGreaterThanOrEqual(frame.y + frame.h)
      }
    expect(
      resolveImagePlacement(
        { fit: 'cover', position: 50, crop: { x: 0, y: 100, zoom: 2 } },
        { width: 100, height: 100 },
        { x: 0, y: 0, w: 100, h: 100 },
      ),
    ).toEqual({ x: 0, y: -100, w: 200, h: 200 })
  })

  it('scales the same crop exactly for a thumbnail, slide and PDF frame', () => {
    const image = { fit: 'cover' as const, position: 50, crop: { x: 12, y: 78, zoom: 2.4 } }
    const natural = { width: 1920, height: 1080 }
    const small = resolveImagePlacement(image, natural, { x: 4, y: 8, w: 100, h: 200 })
    const large = resolveImagePlacement(image, natural, { x: 40, y: 80, w: 1000, h: 2000 })
    expect(large.x).toBeCloseTo(small.x * 10)
    expect(large.y).toBeCloseTo(small.y * 10)
    expect(large.w).toBeCloseTo(small.w * 10)
    expect(large.h).toBeCloseTo(small.h * 10)
    expect(image.crop).toEqual({ x: 12, y: 78, zoom: 2.4 })
  })

  it('ignores saved crop in contain mode and retains its settings for a later switch back', () => {
    const image = { fit: 'contain' as const, position: 0, crop: { x: 100, y: 0, zoom: 4 } }
    expect(
      resolveImagePlacement(image, { width: 200, height: 100 }, { x: 0, y: 0, w: 100, h: 100 }),
    ).toEqual({ x: 0, y: 25, w: 100, h: 50 })
    expect(image.crop).toEqual({ x: 100, y: 0, zoom: 4 })
  })

  it('handles unavailable image dimensions without producing NaN coordinates', () => {
    const frame = { x: 10, y: 20, w: 160, h: 90 }
    expect(
      resolveImagePlacement({ fit: 'cover', position: 50 }, { width: 0, height: NaN }, frame),
    ).toEqual(frame)
    expect(getImageCrop({ position: 30, crop: { x: Infinity, y: -10, zoom: 9 } })).toEqual({
      x: 30,
      y: 0,
      zoom: 4,
    })
  })
})
