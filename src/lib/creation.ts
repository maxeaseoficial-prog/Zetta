import type { GenerationOptions, SourcePage } from '../types'
export interface CreationInput {
  text: string
  sourceName: string
  sourceKind: 'text' | 'pdf'
  pages?: SourcePage[]
  warnings: string[]
  options: GenerationOptions
}
