import type { Deck } from '../types'
import { serializeDeck } from './validation'

export function downloadBackup(deck: Deck) {
  const blob = new Blob([serializeDeck(deck)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    (deck.title.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 70) || 'apresentacao') + '.zetta.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function readImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Escolha uma imagem JPG, PNG ou WebP.')
  if (file.size > 12 * 1024 * 1024) throw new Error('A imagem deve ter até 12 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (image.width * image.height > 80_000_000)
      throw new Error('Esta imagem é muito grande. Reduza a resolução antes de enviar.')
    const ratio = Math.min(1, 2000 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * ratio))
    canvas.height = Math.max(1, Math.round(image.height * ratio))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const result = canvas.toDataURL('image/webp', 0.88)
    if (result.length > 6_500_000)
      throw new Error('A imagem processada ainda é muito grande. Envie uma versão menor.')
    return result
  } finally {
    URL.revokeObjectURL(url)
  }
}
