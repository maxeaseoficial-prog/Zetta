import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Deck, GenerationOptions } from '../src/types'
import {
  buildOutline,
  createBlankSlide,
  createExampleDeck,
  EXAMPLE_TEXT,
  generateDeck,
  getGenerationWarnings,
  parseChartData,
} from '../src/lib/generator'
import {
  deckBackupFilename,
  isSafeImageDataUrl,
  parseDeckImport,
  serializeDeck,
  validateDeck,
} from '../src/lib/validation'
import { extractPdf, MAX_PDF_BYTES } from '../src/lib/pdfImport'
import { deleteDeck, getDeck, listDecks, saveDeck } from '../src/lib/storage'
import { getSlideWarnings } from '../src/components/SlideCanvas'
import { THEMES } from '../src/lib/themes'

const options: GenerationOptions = {
  slideCount: 6,
  themeId: 'minimal',
  accent: '#2563EB',
  density: 'balanced',
  composition: 'rich',
}
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGPIAAAAASUVORK5CYII='
const pdfMocks = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn(async () => undefined) }))
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: pdfMocks.getDocument,
}))
const storageMocks = vi.hoisted(() => ({ records: new Map<string, Deck>(), failNextPut: false }))
vi.mock('idb', () => ({
  openDB: vi.fn(async () => ({
    put: async (_store: string, deck: Deck) => {
      if (storageMocks.failNextPut) {
        storageMocks.failNextPut = false
        throw new DOMException('Test quota', 'QuotaExceededError')
      }
      storageMocks.records.set(deck.id, structuredClone(deck))
    },
    get: async (_store: string, id: string) => structuredClone(storageMocks.records.get(id)),
    getAll: async () => structuredClone([...storageMocks.records.values()]),
    delete: async (_store: string, id: string) => {
      storageMocks.records.delete(id)
    },
  })),
}))

describe('outline and deterministic generation', () => {
  it('counts cover and closing and explains a shorter outline without inventing filler', () => {
    const text = 'Um único ponto claro.'
    const outline = buildOutline(text, { ...options, slideCount: 12 })
    const deck = generateDeck(text, outline, { ...options, slideCount: 12 })
    expect(outline).toHaveLength(1)
    expect(deck.slides).toHaveLength(3)
    expect(deck.slides[0].layout).toBe('cover')
    expect(deck.slides.at(-1)?.layout).toBe('closing')
    expect(
      getGenerationWarnings(text, outline, { ...options, slideCount: 12 }).join(' '),
    ).toContain('3 slides')
  })

  it('preserves every source marker across long text, notes and the original source', () => {
    const paragraphs = Array.from(
      { length: 65 },
      (_, i) =>
        `Tópico ${i + 1}\nMARCADOR_${i}_ ${'Informação fornecida, sem novos fatos. '.repeat(70)}`,
    )
    const text = paragraphs.join('\n\n') + '\nFIM_IMPORTANTE_987'
    const outline = buildOutline(text, { ...options, slideCount: 20 })
    const deck = generateDeck(text, outline, { ...options, slideCount: 20 })
    expect(deck.slides).toHaveLength(20)
    expect(deck.source.text).toBe(text)
    const notes = deck.slides.map((slide) => slide.notes).join('\n')
    for (let i = 0; i < 65; i += 1) expect(notes).toContain(`MARCADOR_${i}_`)
    expect(notes).toContain('FIM_IMPORTANTE_987')
    expect(
      deck.slides.slice(1, -1).every((slide) => slide.eyebrow.includes('Trecho selecionado')),
    ).toBe(true)
    expect(
      deck.slides.some((slide) => slide.blocks.some((block) => block.content.includes('…'))),
    ).toBe(true)
  })

  it('keeps page provenance when PDF text matches and does not invent a page after edits', () => {
    const pages = [
      { page: 1, text: 'Objetivo\nOrganizar a proposta.' },
      { page: 2, text: 'Entregas\nRevisar o conteúdo com o cliente.' },
    ]
    const text = pages.map((page) => page.text).join('\n\n')
    const outline = buildOutline(text, { ...options, slideCount: 4, sourceKind: 'pdf', pages })
    expect(outline.map((item) => item.sourcePages)).toEqual([[1], [2]])
    const deck = generateDeck(text, outline, {
      ...options,
      slideCount: 4,
      sourceKind: 'pdf',
      pages,
    })
    expect(deck.source.pages).toEqual(pages)
    expect(deck.slides[2].notes).toContain('Páginas de origem: 2')
    const edited = buildOutline('Informação nova que não está no PDF.', { ...options, pages })
    expect(edited[0].sourcePages).toEqual([])
    expect(
      getGenerationWarnings('Informação nova que não está no PDF.', edited, {
        ...options,
        pages,
      }).join(' '),
    ).toContain('alterado após')
  })

  it('rejects empty and oversized inputs without producing a misleading deck', () => {
    expect(() => buildOutline('   ', options)).toThrow(/Adicione um texto/)
    expect(() => buildOutline('a'.repeat(500_001), options)).toThrow(/nenhum trecho foi descartado/)
    expect(() => generateDeck('Texto', [], options)).toThrow(/pelo menos um tópico/)
    const outline = buildOutline('Texto', options)
    expect(() => generateDeck('Texto', outline, { ...options, title: 'a'.repeat(241) })).toThrow(
      /título/,
    )
  })

  it('keeps a manually revised outline and its complete content', () => {
    const outline = buildOutline('Proposta original.', options)
    outline[0].title = 'Minha proposta revisada'
    outline[0].content =
      'Preço informado pelo usuário: R$ 997. O serviço inclui somente roteiro e edição.'
    const deck = generateDeck('Proposta original.', outline, options)
    expect(deck.slides[1].title).toBe('Minha proposta revisada')
    expect(deck.slides[1].notes).toContain(outline[0].content)
    expect(deck.source.text).toBe('Proposta original.')
  })

  it('removes stale PDF references after a topic is edited and preserves both versions', () => {
    const pages = [{ page: 1, text: 'Plano original\nA proposta ainda será revisada.' }]
    const input = pages[0].text
    const config: GenerationOptions = { ...options, sourceKind: 'pdf', pages }
    const outline = buildOutline(input, config)
    outline[0].content = 'Uma conclusão acrescentada durante a edição.'
    const deck = generateDeck(input, outline, config)
    expect(deck.slides[1].sourcePages).toEqual([])
    expect(deck.slides[1].notes).toContain(outline[0].content)
    expect(deck.source.pages).toEqual(pages)
    expect(getGenerationWarnings(input, outline, config).join(' ')).toContain(
      'referência de página',
    )
  })

  it('does not turn prose numbers into fabricated chart data', () => {
    const text =
      'Nossa equipe tem 4 pessoas. No dia 12 vamos apresentar a proposta, ainda sem valores definidos.'
    const deck = generateDeck(text, buildOutline(text, options), options)
    expect(
      deck.slides.flatMap((slide) => slide.blocks).some((block) => block.type === 'chart'),
    ).toBe(false)
  })

  it('creates only the provided chart values and keeps their source', () => {
    const text = 'Resultado\nJaneiro;1.250,50\nFevereiro;0\nMarço;-350,75'
    const deck = generateDeck(text, buildOutline(text, options), options)
    const chart = deck.slides
      .flatMap((slide) => slide.blocks)
      .find((block) => block.type === 'chart')?.chart
    expect(chart?.data).toEqual([
      { label: 'Janeiro', value: 1250.5 },
      { label: 'Fevereiro', value: 0 },
      { label: 'Março', value: -350.75 },
    ])
    expect(chart?.source).toContain('material de origem')
  })

  it('gets units from values, never from a currency or percentage mentioned in a label', () => {
    const text = 'Taxa %;20\nPreço R$;30'
    const deck = generateDeck(text, buildOutline(text, options), options)
    const chart = deck.slides
      .flatMap((slide) => slide.blocks)
      .find((block) => block.type === 'chart')?.chart
    expect(chart?.unit).toBe('')
    expect(chart?.data.map((datum) => datum.value)).toEqual([20, 30])
  })

  it('keeps dense chart data intact in notes and explains the text fallback', () => {
    const text = Array.from({ length: 30 }, (_, index) => `Categoria ${index};${index}`).join('\n')
    const outline = buildOutline(text, options)
    const deck = generateDeck(text, outline, options)
    expect(deck.slides[1].blocks.some((block) => block.type === 'chart')).toBe(false)
    expect(deck.slides[1].notes).toContain(text)
    expect(deck.source.text).toBe(text)
    expect(getGenerationWarnings(text, outline, options).join(' ')).toContain('muitas categorias')
  })

  it('does not mistake the first numbered bullet for a heading and drop it from the selection', () => {
    const text = '1. Primeiro item essencial\n2. Segundo item essencial\n3. Terceiro item essencial'
    const deck = generateDeck(text, buildOutline(text, options), options)
    expect(deck.slides[1].blocks[0].type).toBe('bullets')
    expect(deck.slides[1].blocks[0].content).toContain('Primeiro item essencial')
    expect(deck.slides[1].notes).toContain(text)
  })

  it('fits generated slides across all themes, densities and compositions using renderer checks', () => {
    const examples = [
      EXAMPLE_TEXT,
      'Linhas\n' + Array.from({ length: 100 }, (_, index) => `Item ${index}`).join('\n'),
      'Lista\n' +
        Array.from(
          { length: 100 },
          (_, index) => `- ${index}: ${'Um conteúdo informado na fonte. '.repeat(4)}`,
        ).join('\n'),
      'Descrição\n' + 'Um conteúdo extenso que será selecionado com clareza. '.repeat(70),
      Array.from({ length: 16 }, (_, index) => `Região ${index};${index}`).join('\n'),
      Array.from({ length: 30 }, (_, index) => `Região ${index};${index}`).join('\n'),
    ]
    for (const theme of THEMES) {
      for (const slide of createExampleDeck(theme.id).slides)
        expect(getSlideWarnings(slide, theme), `${theme.id}: ${slide.title}`).toEqual([])
      for (const density of ['short', 'balanced', 'detailed'] as const)
        for (const composition of ['simple', 'rich'] as const)
          for (const text of examples) {
            const config: GenerationOptions = {
              ...options,
              themeId: theme.id,
              density,
              composition,
            }
            const outline = buildOutline(text, config)
            const deck = generateDeck(text, outline, config)
            for (const slide of deck.slides)
              expect(
                getSlideWarnings(slide, theme),
                `${theme.id}/${density}/${composition}: ${slide.title}`,
              ).toEqual([])
            expect(deck.source.text).toBe(text)
            outline.forEach((item, index) =>
              expect(deck.slides[index + 1].notes).toContain(item.content),
            )
          }
    }
  })

  it('abbreviates very long visible titles explicitly while preserving the complete title', () => {
    const title = 'W'.repeat(240)
    const outline = buildOutline('Conteúdo integral do tópico.', options)
    outline[0].title = title
    const deck = generateDeck('Conteúdo integral do tópico.', outline, { ...options, title })
    expect(deck.title).toBe(title)
    expect(deck.slides[0].notes).toContain(title)
    expect(deck.slides[1].notes).toContain(title)
    expect(deck.slides[0].title).toContain('…')
    expect(deck.slides[0].notes).toContain('Títulos extensos')
    for (const slide of deck.slides) expect(getSlideWarnings(slide, THEMES[0])).toEqual([])
  })

  it('creates an editable blank and an explicitly identified example without sample statistics', () => {
    expect(createBlankSlide().blocks[0].content).toBe('')
    const deck = createExampleDeck('executive')
    expect(deck.themeId).toBe('executive')
    expect(deck.source.kind).toBe('example')
    expect(deck.slides[0].eyebrow).toContain('exemplo')
    expect(deck.slides.every((slide) => slide.blocks.length <= 6)).toBe(true)
    expect(validateDeck(deck)).toEqual(deck)
  })
})

describe('strict PT-BR chart parsing', () => {
  it('accepts decimal commas, thousands, negatives and zero', () => {
    expect(parseChartData('Mês;Valor\nJan;1.234,56\nFev;0\nMar;-12,5')).toEqual([
      { label: 'Jan', value: 1234.56 },
      { label: 'Fev', value: 0 },
      { label: 'Mar', value: -12.5 },
    ])
    expect(parseChartData('A: R$ 20,50\nB: R$ (5,25)')).toEqual([
      { label: 'A', value: 20.5 },
      { label: 'B', value: -5.25 },
    ])
    expect(parseChartData('A;0%\nB;12,5%')).toEqual([
      { label: 'A', value: 0 },
      { label: 'B', value: 12.5 },
    ])
  })

  it('accepts tabular Markdown, TSV and unambiguous CSV', () => {
    expect(parseChartData('| Mês | Valor |\n| --- | ---: |\n| Jan | 1.000 |\n| Fev | 0 |')).toEqual(
      [
        { label: 'Jan', value: 1000 },
        { label: 'Fev', value: 0 },
      ],
    )
    expect(parseChartData('Jan\t10\nFev\t-2')).toHaveLength(2)
    expect(parseChartData('"Primeiro, trimestre","10,50"\nSegundo,0')).toEqual([
      { label: 'Primeiro, trimestre', value: 10.5 },
      { label: 'Segundo', value: 0 },
    ])
    expect(parseChartData('"O ""primeiro""",10\nSegundo,0')).toEqual([
      { label: 'O "primeiro"', value: 10 },
      { label: 'Segundo', value: 0 },
    ])
    expect(parseChartData('A;0,00000001\nB;0001,23000000')).toEqual([
      { label: 'A', value: 0.00000001 },
      { label: 'B', value: 1.23 },
    ])
  })

  it.each([
    'Jan;10\nFev;desconhecido',
    'Jan;10\nJan;20',
    'Jan;10\njan;20',
    'Jan;R$ 10\nFev;20%',
    'Jan;1.25\nFev;3',
    'Jan,12,50\nFev,3',
    'Jan;12abc',
    'Jan;1e3',
    'Jan;Infinity',
    'Jan;1.00.000',
    ';12',
    'Houve crescimento de 30% em janeiro.',
    'Jan;1;2',
    'Jan;1000000000001',
    'Jan;999999999999,12345678',
    '"Jan"extra,1',
    'Ja"n"eiro,1',
  ])('rejects ambiguous or incomplete input entirely: %s', (text) => {
    expect(parseChartData(text)).toEqual([])
  })
})

describe('validated portable backups', () => {
  let deck: Deck
  beforeEach(() => {
    deck = createExampleDeck()
  })

  it('round-trips an editable deck and its source without dropping content', () => {
    expect(parseDeckImport(serializeDeck(deck))).toEqual(deck)
    expect(deckBackupFilename({ title: 'Apresentação / São Paulo!' })).toBe(
      'Apresentacao-Sao-Paulo.zetta.json',
    )
  })

  it('permits embedded raster images and rejects remote or disguised SVG', () => {
    expect(isSafeImageDataUrl(png)).toBe(true)
    for (const value of [
      'https://example.com/photo.png',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:image/png;base64,PHN2Zz48L3N2Zz4=',
      'javascript:alert(1)',
    ]) {
      expect(isSafeImageDataUrl(value)).toBe(false)
      const image = deck.slides[0].blocks.find((block) => block.type === 'image')!
      image.image!.src = value
      expect(() => parseDeckImport(JSON.stringify(deck))).toThrow(/imagem/i)
    }
    deck.slides[0].blocks.find((block) => block.type === 'image')!.image!.src = png
    expect(
      parseDeckImport(JSON.stringify(deck)).slides[0].blocks.find((block) => block.type === 'image')
        ?.image?.src,
    ).toBe(png)
  })

  it('rejects duplicate object IDs that could corrupt edit targeting', () => {
    deck.slides[1].blocks[0].id = deck.slides[0].blocks[0].id
    expect(() => validateDeck(deck)).toThrow(/duplicado/)
  })

  it('rejects unsupported versions, extra executable fields and CSS URLs', () => {
    expect(() => parseDeckImport(JSON.stringify({ ...deck, schemaVersion: 2 }))).toThrow()
    expect(() => parseDeckImport(JSON.stringify({ ...deck, script: 'alert(1)' }))).toThrow()
    deck.slides[0].background = 'url(https://example.com/tracker)'
    expect(() => validateDeck(deck)).toThrow()
  })

  it('enforces slide and block limits', () => {
    deck.slides = Array.from({ length: 51 }, () => createBlankSlide())
    expect(() => validateDeck(deck)).toThrow()
    deck.slides = [createBlankSlide()]
    deck.slides[0].blocks = Array.from({ length: 7 }, () => createBlankSlide().blocks[0])
    expect(() => validateDeck(deck)).toThrow()
  })

  it('rejects missing chart data and impossible source page references', () => {
    deck.slides[0].blocks = [{ id: 'chart-one', type: 'chart', content: '' }]
    expect(() => validateDeck(deck)).toThrow(/gráfico/)
    deck.slides[0].blocks = []
    deck.source.pages = [{ page: 1, text: 'Fonte.' }]
    deck.slides[0].sourcePages = [2]
    expect(() => validateDeck(deck)).toThrow(/página/)
  })

  it('round-trips a chart draft without inventing data while the renderer blocks its export', () => {
    deck.slides[0].blocks = [
      {
        id: 'empty-chart',
        type: 'chart',
        content: '',
        chart: { type: 'bar', data: [], unit: '', source: '' },
      },
    ]
    expect(parseDeckImport(serializeDeck(deck))).toEqual(deck)
    expect(getSlideWarnings(deck.slides[0], THEMES[0])).toContain(
      'O gráfico precisa de dados antes de exportar.',
    )
  })
})

describe('local persistence snapshots and editable drafts', () => {
  beforeEach(() => {
    storageMocks.records.clear()
    storageMocks.failNextPut = false
    vi.stubGlobal('indexedDB', {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves and reloads an empty chart draft with full source and notes', async () => {
    const deck = createExampleDeck()
    deck.slides[1].blocks = [
      {
        id: 'chart-draft',
        type: 'chart',
        content: '',
        chart: { type: 'bar', data: [], unit: '', source: '' },
      },
    ]
    await saveDeck(deck)
    expect(await getDeck(deck.id)).toEqual(deck)
    expect(await listDecks()).toEqual([deck])
    await deleteDeck(deck.id)
    expect(await getDeck(deck.id)).toBeUndefined()
  })

  it('takes a snapshot immediately and preserves write order for later edits', async () => {
    const deck = createExampleDeck()
    const initial = structuredClone(deck)
    const first = saveDeck(deck)
    deck.title = 'A later mutable edit'
    await first
    expect(await getDeck(deck.id)).toEqual(initial)
    const second = saveDeck(deck)
    deck.title = 'The most recent edit'
    const third = saveDeck(deck)
    await Promise.all([second, third])
    expect((await getDeck(deck.id))?.title).toBe('The most recent edit')
  })

  it('reports a failed write without dropping the existing deck or poisoning future saves', async () => {
    const deck = createExampleDeck()
    await saveDeck(deck)
    const previous = structuredClone(deck)
    storageMocks.failNextPut = true
    deck.title = 'Failed change'
    await expect(saveDeck(deck)).rejects.toThrow(/armazenamento.*cheio/)
    expect(await getDeck(deck.id)).toEqual(previous)
    deck.title = 'Recovered change'
    await saveDeck(deck)
    expect((await getDeck(deck.id))?.title).toBe('Recovered change')
  })
})

describe('PDF extraction boundaries and incomplete documents', () => {
  beforeEach(() => {
    pdfMocks.getDocument.mockReset()
    pdfMocks.destroy.mockClear()
  })
  const file = (): File =>
    ({
      name: 'documento.pdf',
      size: 100,
      arrayBuffer: async () => new TextEncoder().encode('%PDF-1.7\nlocal test').buffer,
    }) as File
  const textItem = (str: string) => ({
    str,
    hasEOL: true,
    transform: [1, 0, 0, 1, 0, 100],
    height: 12,
    width: 100,
  })

  it('rejects oversized and non-PDF files before parsing', async () => {
    await expect(extractPdf({ ...file(), size: MAX_PDF_BYTES + 1 })).rejects.toThrow(/20 MB/)
    await expect(
      extractPdf({
        ...file(),
        arrayBuffer: async () => new TextEncoder().encode('not a pdf').buffer,
      }),
    ).rejects.toThrow(/PDF válido/)
    expect(pdfMocks.getDocument).not.toHaveBeenCalled()
  })

  it('rejects more than 100 pages and cleans up the worker', async () => {
    pdfMocks.getDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 101 }),
      destroy: pdfMocks.destroy,
    })
    await expect(extractPdf(file())).rejects.toThrow(/100 páginas/)
    expect(pdfMocks.destroy).toHaveBeenCalledOnce()
  })

  it('keeps page numbers and reports both empty and failed pages', async () => {
    pdfMocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 3,
        getPage: async (page: number) => {
          if (page === 3) throw new Error('Unreadable page')
          return {
            getTextContent: async () => ({
              items: page === 1 ? [textItem('Conteúdo da página um.')] : [],
            }),
            cleanup: vi.fn(),
          }
        },
      }),
      destroy: pdfMocks.destroy,
    })
    const progress = vi.fn()
    const result = await extractPdf(file(), progress)
    expect(result.pages).toEqual([
      { page: 1, text: 'Conteúdo da página um.' },
      { page: 2, text: '' },
      { page: 3, text: '' },
    ])
    expect(result.warnings.join(' ')).toContain('páginas 2')
    expect(result.warnings.join(' ')).toContain('páginas 3')
    expect(result.warnings.join(' ')).toContain('parcial')
    expect(progress).toHaveBeenLastCalledWith(3, 3)
    expect(pdfMocks.getDocument.mock.calls[0][0]).not.toHaveProperty('url')
    expect(pdfMocks.destroy).toHaveBeenCalledOnce()
  })

  it('does not pretend to perform OCR on a scanned PDF', async () => {
    pdfMocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({ getTextContent: async () => ({ items: [] }), cleanup: vi.fn() }),
      }),
      destroy: pdfMocks.destroy,
    })
    await expect(extractPdf(file())).rejects.toThrow(/ainda não faz OCR/)
  })
})
