export type Layout =
  | 'cover'
  | 'split'
  | 'bullets'
  | 'columns'
  | 'quote'
  | 'chart'
  | 'section'
  | 'closing'
export type ThemeId = 'minimal' | 'executive' | 'editorial' | 'bold' | 'dark' | 'classroom'
export type Density = 'short' | 'balanced' | 'detailed'
export type Composition = 'simple' | 'rich'
export type BlockType = 'text' | 'bullets' | 'image' | 'callout' | 'chart'
export type IllustrationKind = 'orbit' | 'layers' | 'growth' | 'waves' | 'grid'

export interface BlockStyle {
  color?: string
  background?: string
  fontSize?: number
  bold?: boolean
  align?: 'left' | 'center' | 'right'
}
export interface ChartDatum {
  label: string
  value: number
}
export interface SlideBlock {
  id: string
  type: BlockType
  content: string
  style?: BlockStyle
  image?: {
    src?: string
    alt: string
    illustration: IllustrationKind
    fit: 'cover' | 'contain'
    position: number
    seed: number
  }
  chart?: { type: 'bar' | 'line'; data: ChartDatum[]; unit: string; source: string }
}
export interface Slide {
  id: string
  title: string
  eyebrow: string
  layout: Layout
  blocks: SlideBlock[]
  notes: string
  sourcePages: number[]
  background?: string
  titleStyle?: BlockStyle
}
export interface Deck {
  schemaVersion: 1
  id: string
  title: string
  createdAt: string
  updatedAt: string
  themeId: ThemeId
  accent: string
  slides: Slide[]
  source: { text: string; name: string; kind: 'text' | 'pdf' | 'example'; pages?: SourcePage[] }
  settings: { density: Density; composition: Composition }
}
export interface SourcePage {
  page: number
  text: string
}
export interface Theme {
  id: ThemeId
  name: string
  description: string
  background: string
  foreground: string
  muted: string
  accent: string
  surface: string
  fontFamily: string
  dark: boolean
}
export interface OutlineItem {
  id: string
  title: string
  content: string
  sourcePages: number[]
}
export interface GenerationOptions {
  title?: string
  slideCount: number
  themeId: ThemeId
  accent: string
  density: Density
  composition: Composition
  sourceName?: string
  sourceKind?: 'text' | 'pdf' | 'example'
  pages?: SourcePage[]
}
export interface PdfExtraction {
  text: string
  pages: SourcePage[]
  warnings: string[]
  name: string
}
