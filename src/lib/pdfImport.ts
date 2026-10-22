import type { PdfExtraction } from '../types'

export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const MAX_PDF_PAGES = 100
const MAX_TEXT_CHARACTERS = 500_000

interface TextItemLike {
  str: string
  hasEOL: boolean
  transform: number[]
  height: number
  width: number
}

function pageText(items: unknown[]): string {
  let result = ''
  let previous: TextItemLike | undefined
  for (const value of items) {
    if (!value || typeof value !== 'object' || !('str' in value) || typeof value.str !== 'string')
      continue
    const item = value as TextItemLike
    const text = item.str.replace(/\u0000/g, '')
    if (!text) {
      if (item.hasEOL && !result.endsWith('\n')) result += '\n'
      continue
    }
    if (previous && !result.endsWith('\n')) {
      const yDifference = Math.abs((item.transform?.[5] ?? 0) - (previous.transform?.[5] ?? 0))
      const lineThreshold = Math.max(
        2,
        Math.min(Math.abs(item.height || 10), Math.abs(previous.height || 10)) * 0.6,
      )
      if (yDifference > lineThreshold) result += '\n'
      else if (result && !/\s$/.test(result) && !/^\s/.test(text)) {
        const gap = (item.transform?.[4] ?? 0) - ((previous.transform?.[4] ?? 0) + previous.width)
        if (gap > Math.max(0.5, Math.abs(item.height || 10) * 0.08)) result += ' '
      }
    }
    result += text
    if (item.hasEOL) result += '\n'
    previous = item
  }
  return result
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Local-only extraction. The worker is bundled by Vite, never loaded from a CDN. */
export async function extractPdf(
  file: File,
  onProgress?: (current: number, total?: number) => void,
): Promise<PdfExtraction> {
  if (!file.size) throw new Error('O PDF está vazio.')
  if (file.size > MAX_PDF_BYTES)
    throw new Error('O PDF deve ter no máximo 20 MB. Divida o arquivo antes de importar.')
  const data = new Uint8Array(await file.arrayBuffer())
  const header = new TextDecoder('latin1').decode(data.subarray(0, 1_024))
  if (!header.includes('%PDF-'))
    throw new Error('O arquivo selecionado não parece ser um PDF válido.')
  onProgress?.(0)
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    useWasm: false,
    disableAutoFetch: true,
    disableStream: true,
    stopAtErrors: true,
    disableFontFace: true,
    enableXfa: false,
  })
  const pages: PdfExtraction['pages'] = []
  const emptyPages: number[] = []
  const failedPages: number[] = []
  const warnings: string[] = []
  try {
    const pdf = await task.promise
    if (pdf.numPages > MAX_PDF_PAGES)
      throw new Error(
        'O PDF tem mais de 100 páginas. Divida-o em arquivos menores; nenhuma página foi importada parcialmente.',
      )
    onProgress?.(0, pdf.numPages)
    let characters = 0
    for (let number = 1; number <= pdf.numPages; number += 1) {
      let text = ''
      let page: Awaited<ReturnType<typeof pdf.getPage>> | undefined
      try {
        page = await pdf.getPage(number)
        const content = await page.getTextContent()
        text = pageText(content.items)
        if (!text) emptyPages.push(number)
        else if (text.includes('\uFFFD'))
          warnings.push(
            `A página ${number} contém caracteres que não puderam ser lidos com precisão. Revise o trecho extraído.`,
          )
      } catch {
        failedPages.push(number)
      } finally {
        page?.cleanup()
      }
      characters += text.length
      if (characters > MAX_TEXT_CHARACTERS)
        throw new Error(
          'O texto extraído supera 500 mil caracteres. Divida o PDF em partes menores; nenhum trecho foi descartado silenciosamente.',
        )
      pages.push({ page: number, text })
      onProgress?.(number, pdf.numPages)
    }
    if (!pages.some((page) => page.text.trim()))
      throw new Error(
        'Não foi encontrado texto extraível neste PDF. Ele pode ser digitalizado ou protegido. Este fluxo ainda não faz OCR: use um PDF com texto selecionável ou cole o conteúdo.',
      )
    if (emptyPages.length)
      warnings.push(
        `Sem texto extraível nas páginas ${emptyPages.join(', ')}. Elas podem conter imagens ou digitalizações e não contribuíram para o roteiro.`,
      )
    if (failedPages.length)
      warnings.push(
        `Não foi possível ler as páginas ${failedPages.join(', ')}. A importação é parcial; confira essas páginas no original.`,
      )
    warnings.push(
      'Revise a ordem de leitura, tabelas e números. A extração recupera texto e referências de página; ela não reconstrói o layout nem extrai as imagens do PDF.',
    )
    return { text: pages.map((page) => page.text).join('\n\n'), pages, warnings, name: file.name }
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException')
      throw new Error(
        'Este PDF exige uma senha. Envie uma cópia desbloqueada que você tenha permissão para usar.',
      )
    if (
      error instanceof Error &&
      (error.name === 'InvalidPDFException' || error.name === 'MissingPDFException')
    )
      throw new Error('Não foi possível abrir este PDF. O arquivo está inválido ou incompleto.')
    throw error
  } finally {
    await task.destroy().catch(() => undefined)
  }
}
