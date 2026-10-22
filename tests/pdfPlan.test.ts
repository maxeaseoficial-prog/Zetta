import { describe, expect, it } from 'vitest'
import legacy from './fixtures/legacy-v02.zetta.json'
import { getPdfFontPlan } from '../src/lib/exportPdf'
import { fontFamilyFor, fontFileFor, fontIdForFamily } from '../src/lib/fonts'
import { validateDeck } from '../src/lib/validation'

describe('portable PDF font plan', () => {
  it('makes legacy substitutions explicit only for searchable PDF', () => {
    const deck = validateDeck(legacy)
    deck.slides[0].appearance = { themeId: 'editorial', accent: '#A3543D' }
    const previous = JSON.stringify(deck)
    const plan = getPdfFontPlan(deck, 'searchable')
    expect(plan.families).toEqual(['sans', 'serif'])
    expect(plan.warnings.join(' ')).toContain('Arial usa Liberation Sans')
    expect(plan.warnings.join(' ')).toContain('Georgia usa Liberation Serif (slides 1)')
    expect(getPdfFontPlan(deck, 'image')).toEqual({ families: [], warnings: [] })
    expect(JSON.stringify(deck)).toBe(previous)
  })
  it('uses the same exact local family for branded SVG and PDF, respecting reuse snapshots', () => {
    const deck = validateDeck(legacy)
    deck.brand = {
      id: 'brand',
      name: 'Marca',
      font: 'sans',
      footer: '',
      colors: { accent: '#2563EB', background: '#FFFFFF', foreground: '#0F172A' },
    }
    deck.slides[1].appearance = {
      themeId: 'editorial',
      accent: '#A3543D',
      brand: { ...deck.brand, font: 'serif' },
    }
    expect(getPdfFontPlan(deck, 'image')).toEqual({ families: ['sans', 'serif'], warnings: [] })
    expect(getPdfFontPlan(deck, 'searchable')).toEqual({
      families: ['sans', 'serif'],
      warnings: [],
    })
    deck.slides[0].appearance = { themeId: 'minimal', accent: '#2563EB' }
    expect(getPdfFontPlan(deck, 'searchable').warnings).toEqual([
      'Neste PDF, Arial usa Liberation Sans (slides 1).',
    ])
  })
  it('maps only licensed local font files with regular and bold faces', () => {
    expect(fontFamilyFor('sans')).toBe('Liberation Sans')
    expect(fontFamilyFor('serif')).toBe('Liberation Serif')
    expect(fontIdForFamily('"Liberation Serif", serif')).toBe('serif')
    expect(fontIdForFamily('Arial, sans-serif')).toBeNull()
    expect(fontFileFor('sans', 400)).toBe('LiberationSans-Regular.ttf')
    expect(fontFileFor('serif', 700)).toBe('LiberationSerif-Bold.ttf')
  })
})
