import { describe, expect, it } from 'vitest'
import legacy from './fixtures/legacy-v02.zetta.json'
import {
  parseDeckImport,
  serializeDeck,
  validateBrandKit,
  validateDeck,
  validateSlide,
} from '../src/lib/validation'
import type { BrandKit, Deck } from '../src/types'

const brand: BrandKit = {
  id: 'brand-test',
  name: 'Marca de teste',
  colors: { accent: '#2563eb', background: '#ffffff', foreground: '#14233b' },
  font: 'sans',
  footer: 'Dados fictícios · teste',
}

describe('document evolution and self-contained backups', () => {
  it('roundtrips a real v0.2 fixture without creating or dropping fields', () => {
    const deck = parseDeckImport(JSON.stringify(legacy))
    expect(deck).toEqual(legacy)
    expect(parseDeckImport(serializeDeck(deck))).toEqual(legacy)
    expect(deck.slides.some((slide) => slide.blocks.some((block) => block.image?.src))).toBe(true)
    expect(deck.slides.filter((slide) => slide.blocks.some((block) => block.chart))).toHaveLength(6)
  })
  it('keeps all new resources and exact literal data in a backup with no library lookup', () => {
    const deck: Deck = validateDeck(legacy)
    const slide = deck.slides[0]
    deck.brand = {
      ...brand,
      logo: { src: slide.blocks.find((block) => block.image?.src)!.image!.src!, alt: 'Logo teste' },
    }
    deck.settings.brief = { purpose: 'report', audience: 'decision-makers', durationMinutes: 12 }
    slide.appearance = { themeId: 'editorial', accent: '#0033aa' }
    slide.origin = {
      kind: 'reused',
      sourceKind: 'pdf',
      sourceName: 'Outro documento.pdf',
      pages: [89],
      excerpt: 'Receita de R$ 1.250,75; variação de -3,25%.',
      baseline: 'baseline literal',
    }
    slide.requirements = ['Confirmar período dos dados.']
    slide.blocks.find((block) => block.image?.src)!.image!.crop = { x: 17, y: 68, zoom: 2.25 }
    slide.blocks.push({
      id: 'test-diagram',
      type: 'diagram',
      content: 'Indicadores',
      diagram: {
        type: 'metrics',
        source: 'Dados fictícios',
        items: [
          {
            id: 'test-item',
            title: 'Receita',
            value: 'R$ 1.250,75',
            label: '2026',
            description: 'Variação de -3,25%.',
          },
        ],
      },
    })
    expect(parseDeckImport(serializeDeck(deck))).toEqual(deck)
    expect(slide.origin.pages).toEqual([89])
  })
  it('validates new image paths and numerical crop ranges', () => {
    expect(() =>
      validateBrandKit({ ...brand, logo: { src: 'https://example.com/logo.png', alt: 'logo' } }),
    ).toThrow(/incorporado/)
    const deck = validateDeck(legacy)
    deck.slides[0].blocks.find((block) => block.image?.src)!.image!.crop = {
      x: 101,
      y: 50,
      zoom: 1,
    }
    expect(() => validateDeck(deck)).toThrow(/crop/)
  })
  it('rejects duplicate diagram IDs and unknown font contracts before saving', () => {
    expect(() => validateBrandKit({ ...brand, font: 'remote-font' })).toThrow()
    const slide = validateDeck(legacy).slides[0]
    slide.blocks = [
      {
        id: 'diagram-1',
        type: 'diagram',
        content: '',
        diagram: {
          type: 'process',
          source: '',
          items: [
            { id: 'item-1', title: 'A', description: '' },
            { id: 'item-1', title: 'B', description: '' },
          ],
        },
      },
    ]
    expect(() => validateSlide(slide)).toThrow(/duplicado/)
  })
})
