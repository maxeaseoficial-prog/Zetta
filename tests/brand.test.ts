import { describe, expect, it } from 'vitest'
import legacy from './fixtures/legacy-v02.zetta.json'
import type { BrandKit, Deck } from '../src/types'
import {
  applyBrandToDeck,
  createReusableSlide,
  insertReusableSlide,
  resolveAppearance,
  validateReusableSlide,
} from '../src/lib/brand'
import { getTheme } from '../src/lib/themes'
import { parseDeckImport, serializeDeck, validateDeck } from '../src/lib/validation'

const kit: BrandKit = {
  id: 'brand-library-test',
  name: 'Marca local',
  colors: { accent: '#1d4ed8', background: '#f8fafc', foreground: '#172554' },
  font: 'serif',
  footer: 'Documento de teste',
}

function sourceDeck(): Deck {
  return validateDeck(legacy)
}

describe('brand application and appearance snapshots', () => {
  it('keeps legacy themes intact and prevents a saved unbranded slide inheriting another brand', () => {
    const theme = getTheme('dark')
    const original = structuredClone(theme)
    expect(resolveAppearance({}, theme, '#f43f5e')).toEqual({ theme, accent: '#f43f5e' })
    const snapshot = resolveAppearance(
      { appearance: { themeId: 'editorial', accent: '#7733aa' } },
      theme,
      '#f43f5e',
      kit,
    )
    expect(snapshot.theme).toEqual(getTheme('editorial'))
    expect(snapshot.accent).toBe('#7733aa')
    expect(snapshot.brand).toBeUndefined()
    expect(theme).toEqual(original)
  })

  it('preserves individual overrides and copies the entire brand into the document', () => {
    const deck = sourceDeck()
    deck.slides[0].background = '#ffedd5'
    deck.slides[0].titleStyle = { color: '#9a3412', bold: true, fontSize: 64 }
    deck.slides[1].appearance = { themeId: 'dark', accent: '#a5b4fc' }
    const original = structuredClone(deck)
    const next = applyBrandToDeck(deck, kit)
    expect(deck).toEqual(original)
    expect(next.slides).toEqual(original.slides)
    expect(next.brand).toEqual(kit)
    expect(next.brand).not.toBe(kit)
    const resolved = resolveAppearance(
      next.slides[0],
      getTheme(next.themeId),
      next.accent,
      next.brand,
    )
    expect(resolved.theme.fontFamily).toBe('Liberation Serif')
    expect(resolved.theme.background).toBe('#f8fafc')
    expect(resolved.accent).toBe('#1d4ed8')
    expect(parseDeckImport(serializeDeck(next))).toEqual(next)
  })

  it('only removes visual color overrides on the explicit reset option', () => {
    const deck = sourceDeck()
    deck.slides[0].background = '#ffedd5'
    deck.slides[0].titleStyle = {
      color: '#9a3412',
      background: '#ffffff',
      bold: true,
      fontSize: 64,
    }
    deck.slides[0].blocks[0].style = {
      color: '#000000',
      background: '#ffffff',
      align: 'right',
      fontSize: 28,
    }
    deck.slides[1].appearance = { themeId: 'dark', accent: '#a5b4fc', brand: kit }
    const original = structuredClone(deck)
    const next = applyBrandToDeck(deck, kit, 'reset-colors')
    expect(next.slides[0].background).toBeUndefined()
    expect(next.slides[0].titleStyle).toEqual({ bold: true, fontSize: 64 })
    expect(next.slides[0].blocks[0].style).toEqual({ align: 'right', fontSize: 28 })
    expect(next.slides[1].appearance).toBeUndefined()
    expect(next.slides[1].blocks).toEqual(original.slides[1].blocks)
    expect(next.slides[0].notes).toBe(original.slides[0].notes)
    expect(next.source).toEqual(original.source)
    expect(deck).toEqual(original)
  })
})

describe('self-contained reusable slides', () => {
  it('incorporates legacy source text, images and visual settings without modifying the source', () => {
    const deck = sourceDeck()
    deck.brand = { ...kit, logo: { src: deck.slides[0].blocks[1].image!.src!, alt: 'Logo local' } }
    deck.source.kind = 'pdf'
    deck.source.name = 'Origem.pdf'
    deck.source.pages = [{ page: 7, text: 'Página original' }]
    deck.slides[0].sourcePages = [7]
    deck.slides[0].blocks[1].image!.crop = { x: 25, y: 78, zoom: 2.4 }
    const original = structuredClone(deck)
    const item = createReusableSlide(deck, deck.slides[0].id, 'Capa aprovada')
    expect(item.slide.appearance).toEqual({
      themeId: deck.themeId,
      accent: deck.accent,
      brand: deck.brand,
    })
    expect(item.slide.origin).toEqual({
      kind: 'reused',
      sourceName: 'Origem.pdf',
      sourceKind: 'pdf',
      excerpt: deck.source.text,
      pages: [7],
    })
    expect(item.slide.sourcePages).toEqual([])
    expect(item.slide.blocks).toEqual(deck.slides[0].blocks)
    expect(item.slide.appearance!.brand).not.toBe(deck.brand)
    expect(deck).toEqual(original)
    expect(validateReusableSlide(JSON.parse(JSON.stringify(item)))).toEqual(item)
  })

  it('preserves explicit source excerpts, page references and baselines after multiple reuses', () => {
    const source = sourceDeck()
    source.slides[1].origin = {
      kind: 'source',
      sourceKind: 'pdf',
      sourceName: 'Demonstração.pdf',
      pages: [91],
      excerpt: 'Receita R$ 1.250,75; variação -3,25%.',
      baseline: 'Conteúdo literal aprovado',
    }
    source.slides[1].blocks[0].chart!.data[0].value = 1250.75
    source.slides[1].blocks.push({
      id: 'original-diagram',
      type: 'diagram',
      content: '',
      diagram: {
        type: 'metrics',
        source: 'Demonstração.pdf, p. 91',
        items: [
          {
            id: 'original-metric',
            title: 'Variação',
            value: '-3,25%',
            description: 'Valor literal',
          },
        ],
      },
    })
    const item = createReusableSlide(source, source.slides[1].id)
    const destination = sourceDeck()
    destination.source = {
      kind: 'pdf',
      name: 'Destino.pdf',
      text: 'Outro texto',
      pages: [{ page: 1, text: 'Outro texto' }],
    }
    const original = structuredClone(destination)
    const once = insertReusableSlide(destination, item, 0)
    const twice = insertReusableSlide(once, item, 1)
    const inserted = twice.slides[1]
    expect(inserted.origin).toEqual({ ...source.slides[1].origin, kind: 'reused' })
    expect(inserted.sourcePages).toEqual([])
    expect(inserted.blocks[0].chart).toEqual(source.slides[1].blocks[0].chart)
    expect(inserted.blocks[1].diagram!.items[0].value).toBe('-3,25%')
    const ids = twice.slides.flatMap((slide) => [
      slide.id,
      ...slide.blocks.flatMap((block) => [
        block.id,
        ...(block.diagram?.items.map((entry) => entry.id) ?? []),
      ]),
    ])
    expect(new Set(ids).size).toBe(ids.length)
    expect(destination).toEqual(original)
    expect(parseDeckImport(serializeDeck(twice))).toEqual(twice)
    const savedAgain = createReusableSlide(twice, inserted.id)
    expect(savedAgain.slide.origin).toEqual(inserted.origin)
  })

  it('adapts appearance only when requested and keeps the original photo, crop and custom styles', () => {
    const source = sourceDeck()
    source.brand = kit
    source.slides[0].blocks[1].image!.crop = { x: 0, y: 100, zoom: 3 }
    source.slides[0].blocks[0].style = { color: '#123456', bold: true }
    const item = createReusableSlide(source, source.slides[0].id)
    const destination = sourceDeck()
    destination.themeId = 'dark'
    destination.brand = { ...kit, id: 'destination-brand', font: 'sans' }
    const preserved = insertReusableSlide(destination, item, -1)
    const adapted = insertReusableSlide(destination, item, -1, 'adapt')
    expect(preserved.slides[0].appearance).toEqual(item.slide.appearance)
    expect(adapted.slides[0].appearance).toBeUndefined()
    expect(adapted.slides[0].blocks[1].image).toEqual(source.slides[0].blocks[1].image)
    expect(adapted.slides[0].blocks[0].style).toEqual(source.slides[0].blocks[0].style)
    expect(adapted.slides[0].origin).toEqual(item.slide.origin)
    expect(item.slide.appearance?.brand?.font).toBe('serif')
  })

  it('uses honest notes as the origin for a manual legacy slide and refuses incomplete shelf items', () => {
    const deck = sourceDeck()
    deck.source.text = ''
    deck.slides[0].notes = 'Anotação original: 12,5%.'
    const item = createReusableSlide(deck, deck.slides[0].id)
    expect(item.slide.origin).toMatchObject({
      sourceKind: 'manual',
      sourceName: `Notas de ${deck.title}`,
      excerpt: deck.slides[0].notes,
    })
    const broken = structuredClone(item)
    delete broken.slide.appearance
    expect(() => validateReusableSlide(broken)).toThrow(/aparência e origem/)
    expect(() => createReusableSlide(deck, 'missing-slide')).toThrow(/existente/)
  })

  it('rejects insertion beyond the document limit without altering the document or saved slide', () => {
    const deck = sourceDeck()
    const item = createReusableSlide(deck, deck.slides[1].id)
    while (deck.slides.length < 50) {
      const slide = structuredClone(deck.slides[0])
      slide.id = crypto.randomUUID()
      slide.blocks.forEach((block) => {
        block.id = crypto.randomUUID()
      })
      deck.slides.push(slide)
    }
    const original = JSON.stringify(deck)
    const saved = JSON.stringify(item)
    expect(() => insertReusableSlide(deck, item, 0)).toThrow(/50 slides/)
    expect(JSON.stringify(deck)).toBe(original)
    expect(JSON.stringify(item)).toBe(saved)
  })
})
