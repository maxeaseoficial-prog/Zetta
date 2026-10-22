import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { BrandKit, Deck, ReusableSlide } from '../types'
import { validateBrandKit, validateDeck } from './validation'
import { documentBytes, validateReusableSlide } from './brand'

export const MAX_BRAND_PROFILES = 20
export const MAX_REUSABLE_SLIDES = 50
export const MAX_LIBRARY_BYTES = 64 * 1024 * 1024

export interface BrandProfileSummary {
  id: string
  name: string
  bytes: number
}
export interface ReusableSlideSummary {
  id: string
  name: string
  createdAt: string
  bytes: number
}
export interface LibraryStats {
  brands: number
  slides: number
  bytes: number
  maxBytes: number
}

interface ZettaDatabase extends DBSchema {
  decks: { key: string; value: Deck; indexes: { updatedAt: string } }
  brandProfiles: {
    key: string
    value: BrandProfileSummary & { kit: BrandKit }
    indexes: { summary: [string, number] }
  }
  reusableSlides: {
    key: string
    value: ReusableSlideSummary & { item: ReusableSlide }
    indexes: { summary: [string, string, number] }
  }
}

let databasePromise: Promise<IDBPDatabase<ZettaDatabase>> | undefined
let writes: Promise<void> = Promise.resolve()

function database(): Promise<IDBPDatabase<ZettaDatabase>> {
  if (!globalThis.indexedDB)
    return Promise.reject(
      new Error(
        'O armazenamento local não está disponível neste navegador. Ative o armazenamento do site para salvar suas apresentações.',
      ),
    )
  if (!databasePromise) {
    let connection: IDBPDatabase<ZettaDatabase> | undefined
    databasePromise = openDB<ZettaDatabase>('zetta-local', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const decks = db.createObjectStore('decks', { keyPath: 'id' })
          decks.createIndex('updatedAt', 'updatedAt')
        }
        if (oldVersion < 2) {
          const brands = db.createObjectStore('brandProfiles', { keyPath: 'id' })
          brands.createIndex('summary', ['name', 'bytes'])
          const slides = db.createObjectStore('reusableSlides', { keyPath: 'id' })
          slides.createIndex('summary', ['createdAt', 'name', 'bytes'])
        }
      },
      blocking() {
        connection?.close()
        databasePromise = undefined
      },
      terminated() {
        databasePromise = undefined
      },
    })
      .then((db) => {
        connection = db
        return db
      })
      .catch((error) => {
        databasePromise = undefined
        throw storageError(error)
      })
  }
  return databasePromise
}

function storageError(error: unknown): Error {
  if (error instanceof Error && error.name === 'QuotaExceededError')
    return new Error(
      'O armazenamento deste navegador está cheio. Exporte um backup antes de remover apresentações ou reduzir imagens.',
    )
  return new Error(
    `Não foi possível acessar o armazenamento local. ${error instanceof Error ? error.message : 'Verifique as permissões do navegador.'}`,
  )
}

function queueWrite(operation: () => Promise<void>): Promise<void> {
  const next = writes
    .catch(() => undefined)
    .then(operation)
    .catch((error) => {
      throw storageError(error)
    })
  writes = next
  return next
}

export async function listDecks(): Promise<Deck[]> {
  await writes.catch(() => undefined)
  const stored = await (await database()).getAll('decks')
  return stored.map(validateDeck).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export async function saveDeck(deck: Deck): Promise<void> {
  // Validate and clone now so a later caller mutation cannot change the pending write.
  const snapshot = validateDeck(deck)
  await queueWrite(async () => {
    await (await database()).put('decks', snapshot)
  })
}

export async function deleteDeck(id: string): Promise<void> {
  await queueWrite(async () => {
    await (await database()).delete('decks', id)
  })
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  await writes.catch(() => undefined)
  const deck = await (await database()).get('decks', id)
  return deck === undefined ? undefined : validateDeck(deck)
}

interface SummaryCursor {
  key: unknown
  primaryKey: IDBValidKey
  continue(): Promise<SummaryCursor | null>
}

/** Index-only reads avoid loading every embedded logo/photo just to show a list. */
async function indexEntries(cursorPromise: Promise<SummaryCursor | null>) {
  const entries: { id: string; parts: (string | number)[] }[] = []
  let cursor = await cursorPromise
  while (cursor) {
    entries.push({ id: String(cursor.primaryKey), parts: cursor.key as (string | number)[] })
    cursor = await cursor.continue()
  }
  return entries
}

async function librarySummaries() {
  await writes.catch(() => undefined)
  const transaction = (await database()).transaction(
    ['brandProfiles', 'reusableSlides'],
    'readonly',
  )
  const [brands, slides] = await Promise.all([
    indexEntries(transaction.objectStore('brandProfiles').index('summary').openKeyCursor()),
    indexEntries(transaction.objectStore('reusableSlides').index('summary').openKeyCursor()),
  ])
  await transaction.done
  return {
    brands: brands.map(({ id, parts }) => ({
      id,
      name: String(parts[0]),
      bytes: Number(parts[1]),
    })),
    slides: slides.map(({ id, parts }) => ({
      id,
      createdAt: String(parts[0]),
      name: String(parts[1]),
      bytes: Number(parts[2]),
    })),
  }
}

export async function listBrandProfiles(): Promise<BrandProfileSummary[]> {
  return (await librarySummaries()).brands.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export async function listReusableSlides(): Promise<ReusableSlideSummary[]> {
  return (await librarySummaries()).slides.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getLibraryStats(): Promise<LibraryStats> {
  const { brands, slides } = await librarySummaries()
  return {
    brands: brands.length,
    slides: slides.length,
    bytes: [...brands, ...slides].reduce((sum, item) => sum + item.bytes, 0),
    maxBytes: MAX_LIBRARY_BYTES,
  }
}

export async function getBrandProfile(id: string): Promise<BrandKit | undefined> {
  await writes.catch(() => undefined)
  const row = await (await database()).get('brandProfiles', id)
  return row ? validateBrandKit(row.kit) : undefined
}

export async function getReusableSlide(id: string): Promise<ReusableSlide | undefined> {
  await writes.catch(() => undefined)
  const row = await (await database()).get('reusableSlides', id)
  return row ? validateReusableSlide(row.item) : undefined
}

async function putLibraryItem(
  kind: 'brandProfiles' | 'reusableSlides',
  item: BrandKit | ReusableSlide,
) {
  const bytes = documentBytes(item)
  if (bytes > MAX_LIBRARY_BYTES)
    throw new Error('Este item ultrapassa os 64 MB disponíveis para a biblioteca local.')
  await queueWrite(async () => {
    // One transaction also protects count/budget checks against another browser tab.
    const transaction = (await database()).transaction(
      ['brandProfiles', 'reusableSlides'],
      'readwrite',
    )
    try {
      const [brands, slides] = await Promise.all([
        indexEntries(transaction.objectStore('brandProfiles').index('summary').openKeyCursor()),
        indexEntries(transaction.objectStore('reusableSlides').index('summary').openKeyCursor()),
      ])
      const items = kind === 'brandProfiles' ? brands : slides
      const limit = kind === 'brandProfiles' ? MAX_BRAND_PROFILES : MAX_REUSABLE_SLIDES
      const previous = items.find((entry) => entry.id === item.id)
      if (!previous && items.length >= limit)
        throw new Error(
          `A biblioteca já tem ${limit} ${kind === 'brandProfiles' ? 'marcas' : 'slides'}. Exclua um item antes de salvar outro.`,
        )
      const used = [...brands, ...slides].reduce(
        (sum, entry) => sum + Number(entry.parts.at(-1)),
        0,
      )
      const previousBytes = previous ? Number(previous.parts.at(-1)) : 0
      if (used - previousBytes + bytes > MAX_LIBRARY_BYTES)
        throw new Error(
          'A biblioteca ultrapassaria 64 MB. Exclua itens que não usa antes de salvar; suas apresentações continuam preservadas.',
        )
      if (kind === 'brandProfiles') {
        const kit = item as BrandKit
        await transaction
          .objectStore('brandProfiles')
          .put({ id: kit.id, name: kit.name, bytes, kit })
      } else {
        const slide = item as ReusableSlide
        await transaction
          .objectStore('reusableSlides')
          .put({ id: slide.id, name: slide.name, createdAt: slide.createdAt, bytes, item: slide })
      }
      await transaction.done
    } catch (error) {
      try {
        transaction.abort()
      } catch {
        /* already completed or aborted */
      }
      await transaction.done.catch(() => undefined)
      throw error
    }
  })
}

export async function saveBrandProfile(value: BrandKit): Promise<void> {
  await putLibraryItem('brandProfiles', validateBrandKit(value))
}

export async function saveReusableSlide(value: ReusableSlide): Promise<void> {
  await putLibraryItem('reusableSlides', validateReusableSlide(value))
}

export async function deleteBrandProfile(id: string): Promise<void> {
  await queueWrite(async () => {
    await (await database()).delete('brandProfiles', id)
  })
}

export async function deleteReusableSlide(id: string): Promise<void> {
  await queueWrite(async () => {
    await (await database()).delete('reusableSlides', id)
  })
}
