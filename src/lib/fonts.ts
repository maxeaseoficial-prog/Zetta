import type { BrandFontId } from '../types'

export type PortableFontWeight = 400 | 700
const families = { sans: 'Liberation Sans', serif: 'Liberation Serif' } as const
const files = {
  sans: { 400: 'LiberationSans-Regular.ttf', 700: 'LiberationSans-Bold.ttf' },
  serif: { 400: 'LiberationSerif-Regular.ttf', 700: 'LiberationSerif-Bold.ttf' },
} as const
const bytes = new Map<string, Promise<Uint8Array>>()
const pending = new Map<BrandFontId, Promise<void>>()
const ready = new Set<BrandFontId>()

export function fontFamilyFor(id: BrandFontId): string {
  return families[id]
}

export function fontIdForFamily(family: string): BrandFontId | null {
  return family.includes(families.serif) ? 'serif' : family.includes(families.sans) ? 'sans' : null
}

export function fontFileFor(id: BrandFontId, weight: PortableFontWeight): string {
  return files[id][weight]
}

export function areBrandFontsReady(id: BrandFontId): boolean {
  return ready.has(id)
}

/** Font bytes are fetched only for a selected family, and reused by PDF export. */
export function loadFontBytes(id: BrandFontId, weight: PortableFontWeight): Promise<Uint8Array> {
  const file = files[id][weight]
  let task = bytes.get(file)
  if (!task) {
    const base = import.meta.env?.BASE_URL ?? '/'
    task = fetch(`${base}fonts/${file}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Não foi possível carregar a fonte ${families[id]}. Tente novamente.`)
        const data = new Uint8Array(await response.arrayBuffer())
        if (
          data.byteLength < 1000 ||
          data.byteLength > 1_000_000 ||
          new DataView(data.buffer).getUint32(0) !== 0x00010000
        ) {
          throw new Error(`O arquivo da fonte ${families[id]} não é válido.`)
        }
        return data
      })
      .catch((error) => {
        bytes.delete(file)
        throw error
      })
    bytes.set(file, task)
  }
  return task
}

/** The browser and the PDF use exactly these same, unmodified OFL font files. */
export function ensureBrandFonts(id: BrandFontId): Promise<void> {
  if (ready.has(id)) return Promise.resolve()
  let task = pending.get(id)
  if (!task) {
    task = (async () => {
      if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
        throw new Error('Abra a apresentação em um navegador para carregar a fonte da marca.')
      }
      const faces = await Promise.all(
        ([400, 700] as const).map(async (weight) => {
          const data = await loadFontBytes(id, weight)
          const face = new FontFace(families[id], data.slice().buffer, {
            weight: String(weight),
            style: 'normal',
          })
          await face.load()
          return face
        }),
      )
      faces.forEach((face) => document.fonts.add(face))
      await document.fonts.ready
      ready.add(id)
    })().catch((error) => {
      pending.delete(id)
      throw error
    })
    pending.set(id, task)
  }
  return task
}
