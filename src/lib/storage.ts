import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Deck } from '../types'
import { validateDeck } from './validation'

interface ZettaDatabase extends DBSchema {
  decks: { key: string; value: Deck; indexes: { updatedAt: string } }
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
    databasePromise = openDB<ZettaDatabase>('zetta-local', 1, {
      upgrade(db) {
        const decks = db.createObjectStore('decks', { keyPath: 'id' })
        decks.createIndex('updatedAt', 'updatedAt')
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
