import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { BrandKit, Deck } from '../../src/types'

const legacy = JSON.parse(
  readFileSync(new URL('../fixtures/legacy-v02.zetta.json', import.meta.url), 'utf8'),
) as Deck

const kit: BrandKit = {
  id: 'storage-brand',
  name: 'Marca de teste',
  colors: { accent: '#2563eb', background: '#ffffff', foreground: '#172554' },
  font: 'sans',
  footer: '',
}

test.beforeEach(async ({ context, page }) => {
  // A same-origin blank page avoids booting the application before storage is exercised.
  await context.route('**/__library-storage-test', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="pt-BR"><title>Teste isolado de armazenamento</title><body>IndexedDB</body></html>',
    }),
  )
  await page.goto('/__library-storage-test')
})

test('enforces the brand limit across tabs and recovers after a rejected browser write', async ({
  page,
  context,
}) => {
  await page.evaluate(
    async ({ brand, deck }) => {
      const path = '/src/lib/storage.ts'
      const storage = (await import(
        /* @vite-ignore */ path
      )) as typeof import('../../src/lib/storage')
      await storage.saveDeck(deck as Deck)
      await Promise.all(
        Array.from({ length: 19 }, (_, index) =>
          storage.saveBrandProfile({ ...brand, id: `initial-${index}` }),
        ),
      )
    },
    { brand: kit, deck: legacy },
  )
  const other = await context.newPage()
  await other.goto('/__library-storage-test')
  const results = await Promise.all(
    [page, other].map((tab, index) =>
      tab.evaluate(
        async ({ brand, index }) => {
          const path = '/src/lib/storage.ts'
          const storage = (await import(
            /* @vite-ignore */ path
          )) as typeof import('../../src/lib/storage')
          try {
            await storage.saveBrandProfile({ ...brand, id: `concurrent-${index}` })
            return 'saved'
          } catch (error) {
            return error instanceof Error ? error.message : 'unexpected error'
          }
        },
        { brand: kit, index },
      ),
    ),
  )
  expect(results.filter((result) => result === 'saved')).toHaveLength(1)
  expect(results.find((result) => result !== 'saved')).toContain('20 marcas')

  const result = await page.evaluate(
    async ({ brand, deck }) => {
      const path = '/src/lib/storage.ts'
      const storage = (await import(
        /* @vite-ignore */ path
      )) as typeof import('../../src/lib/storage')
      const before = await storage.getBrandProfile('initial-0')
      const nativePut = IDBObjectStore.prototype.put
      let failed = ''
      try {
        IDBObjectStore.prototype.put = function (
          this: IDBObjectStore,
          value: { id?: string },
          key?: IDBValidKey,
        ) {
          if (this.name === 'brandProfiles' && value.id === 'initial-0')
            throw new DOMException(
              'Quota intentionally denied by the browser test',
              'QuotaExceededError',
            )
          return nativePut.call(this, value, key)
        }
        try {
          await storage.saveBrandProfile({
            ...brand,
            id: 'initial-0',
            name: 'This write must fail',
          })
        } catch (error) {
          failed = error instanceof Error ? error.message : 'unexpected error'
        }
      } finally {
        IDBObjectStore.prototype.put = nativePut
      }
      const afterFailure = await storage.getBrandProfile('initial-0')
      // An overwrite at the cap must succeed, including after an earlier failed queued operation.
      await storage.saveBrandProfile({ ...brand, id: 'initial-0', name: 'Gravação recuperada' })
      let invalid = false
      try {
        await storage.saveBrandProfile({ ...brand, id: 'initial-0', name: '' })
      } catch {
        invalid = true
      }
      const afterRecovery = await storage.getBrandProfile('initial-0')
      return {
        failed,
        invalid,
        before,
        afterFailure,
        afterRecovery,
        stats: await storage.getLibraryStats(),
        storedDeck: await storage.getDeck(deck.id),
      }
    },
    { brand: kit, deck: legacy },
  )
  expect(result.failed).toContain('armazenamento deste navegador está cheio')
  expect(result.afterFailure).toEqual(result.before)
  expect(result.afterRecovery?.name).toBe('Gravação recuperada')
  expect(result.invalid).toBe(true)
  expect(result.stats.brands).toBe(20)
  expect(result.storedDeck).toEqual(legacy)
  await page.reload()
  const persisted = await page.evaluate(async () => {
    const path = '/src/lib/storage.ts'
    const storage = (await import(
      /* @vite-ignore */ path
    )) as typeof import('../../src/lib/storage')
    return (await storage.getBrandProfile('initial-0'))?.name
  })
  expect(persisted).toBe('Gravação recuperada')
})

test('keeps saved chart values intact when the slide shelf reaches its limit', async ({ page }) => {
  const result = await page.evaluate(async (deck) => {
    const storagePath = '/src/lib/storage.ts',
      brandPath = '/src/lib/brand.ts'
    const storage = (await import(
      /* @vite-ignore */ storagePath
    )) as typeof import('../../src/lib/storage')
    const brand = (await import(
      /* @vite-ignore */ brandPath
    )) as typeof import('../../src/lib/brand')
    const item = brand.createReusableSlide(deck as Deck, deck.slides[1].id, 'Gráfico aprovado')
    item.slide.blocks[0].chart!.data[0].value = 1250.7500123
    await Promise.all(
      Array.from({ length: 50 }, (_, index) =>
        storage.saveReusableSlide({ ...item, id: `saved-slide-${index}` }),
      ),
    )
    let full = ''
    try {
      await storage.saveReusableSlide({ ...item, id: 'one-too-many' })
    } catch (error) {
      full = error instanceof Error ? error.message : 'unexpected error'
    }
    await storage.saveReusableSlide({ ...item, id: 'saved-slide-0', name: 'Nome atualizado' })
    const invalid = structuredClone(item)
    invalid.id = 'saved-slide-0'
    invalid.slide.blocks[0].chart!.data[0].value = NaN
    try {
      await storage.saveReusableSlide(invalid)
    } catch {
      /* expected validation failure */
    }
    const preserved = await storage.getReusableSlide('saved-slide-0')
    await storage.deleteReusableSlide('saved-slide-49')
    await storage.saveReusableSlide({ ...item, id: 'replacement-slide' })
    return {
      full,
      preserved,
      stats: await storage.getLibraryStats(),
      missing: await storage.getReusableSlide('one-too-many'),
    }
  }, legacy)
  expect(result.full).toContain('50 slides')
  expect(result.stats.slides).toBe(50)
  expect(result.preserved?.name).toBe('Nome atualizado')
  expect(result.preserved?.slide.blocks[0].chart?.data[0].value).toBe(1250.7500123)
  expect(result.missing).toBeUndefined()
})

test('accounts for embedded bytes across both libraries and frees capacity on deletion', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const result = await page.evaluate(
    async ({ brand: base, deck }) => {
      const storagePath = '/src/lib/storage.ts',
        brandPath = '/src/lib/brand.ts'
      const storage = (await import(
        /* @vite-ignore */ storagePath
      )) as typeof import('../../src/lib/storage')
      const brand = (await import(
        /* @vite-ignore */ brandPath
      )) as typeof import('../../src/lib/brand')
      // A valid small PNG with trailing padding creates a deterministic 5 MiB embedded resource.
      // No raster decoding or network transfer is involved in this storage budget test.
      const png = atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZn8AAAAASUVORK5CYII=',
      )
      const src = 'data:image/png;base64,' + btoa(png + '\0'.repeat(5 * 1024 * 1024 - png.length))
      const large = { ...base, logo: { src, alt: 'Recurso de teste de limite' } }
      for (let index = 0; index < 8; index++)
        await storage.saveBrandProfile({ ...large, id: `large-${index}` })
      const item = brand.createReusableSlide(deck as Deck, deck.slides[0].id)
      item.slide.blocks.find((block) => block.image)!.image!.src = src
      await storage.saveReusableSlide(item)
      const before = await storage.getLibraryStats()
      let full = ''
      try {
        await storage.saveBrandProfile({ ...large, id: 'over-budget' })
      } catch (error) {
        full = error instanceof Error ? error.message : 'unexpected error'
      }
      const afterFailure = await storage.getLibraryStats()
      const absent = (await storage.getBrandProfile('over-budget')) === undefined
      await storage.deleteBrandProfile('large-0')
      const afterDelete = await storage.getLibraryStats()
      await storage.saveBrandProfile({ ...large, id: 'recovered-capacity' })
      const afterRecovery = await storage.getLibraryStats()
      return {
        before,
        full,
        afterFailure,
        absent,
        afterDelete,
        afterRecovery,
        itemUnchanged:
          (await storage.getReusableSlide(item.id))?.slide.blocks.find((block) => block.image)
            ?.image?.src === src,
      }
    },
    { brand: kit, deck: legacy },
  )
  expect(result.before.brands).toBe(8)
  expect(result.before.slides).toBe(1)
  expect(result.before.bytes).toBeGreaterThan(59 * 1024 * 1024)
  expect(result.before.bytes).toBeLessThan(result.before.maxBytes)
  expect(result.full).toContain('64 MB')
  expect(result.afterFailure).toEqual(result.before)
  expect(result.absent).toBe(true)
  expect(result.afterDelete.bytes).toBeLessThan(result.before.bytes)
  expect(result.afterRecovery.brands).toBe(8)
  expect(result.afterRecovery.bytes).toBeLessThan(result.afterRecovery.maxBytes)
  expect(result.itemUnchanged).toBe(true)
})
