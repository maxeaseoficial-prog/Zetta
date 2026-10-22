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
export type BlockType = 'text' | 'bullets' | 'image' | 'callout' | 'chart' | 'diagram'
export type IllustrationKind = 'orbit' | 'layers' | 'growth' | 'waves' | 'grid'

export type BrandFontId = 'sans' | 'serif'
export interface BrandKit {
  id: string
  name: string
  logo?: { src: string; alt: string }
  colors: { accent: string; background: string; foreground: string }
  font: BrandFontId
  footer: string
}
export interface SlideAppearance {
  themeId: ThemeId
  accent: string
  brand?: BrandKit
}
export interface ImageCrop {
  x: number
  y: number
  zoom: number
}
export interface PresentationBrief {
  purpose: 'general' | 'proposal' | 'report' | 'lesson' | 'institutional'
  audience: 'general' | 'decision-makers' | 'technical' | 'students'
  durationMinutes?: number
}
export interface ContentOrigin {
  kind: 'source' | 'manual' | 'editorial' | 'reused'
  sourceName: string
  sourceKind: 'text' | 'pdf' | 'example' | 'manual'
  excerpt: string
  pages: number[]
  baseline?: string
}
export type DiagramType = 'process' | 'timeline' | 'comparison' | 'metrics'
export interface DiagramItem {
  id: string
  title: string
  description: string
  label?: string
  value?: string
}
export interface DiagramConfig {
  type: DiagramType
  items: DiagramItem[]
  source: string
}

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
export type ChartType = 'bar' | 'horizontalBar' | 'line' | 'area' | 'pie' | 'donut'
export interface ChartSeries {
  name: string
  values: number[]
}
export interface ChartConfig {
  type: ChartType
  data: ChartDatum[]
  unit: string
  source: string
  seriesName?: string
  additionalSeries?: ChartSeries[]
  animate?: boolean
  showValues?: boolean
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
    crop?: ImageCrop
  }
  chart?: ChartConfig
  diagram?: DiagramConfig
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
  appearance?: SlideAppearance
  origin?: ContentOrigin
  requirements?: string[]
}
export interface ReusableSlide {
  id: string
  name: string
  createdAt: string
  slide: Slide
}
export interface Deck {
  schemaVersion: 1
  id: string
  title: string
  createdAt: string
  updatedAt: string
  themeId: ThemeId
  accent: string
  brand?: BrandKit
  slides: Slide[]
  source: { text: string; name: string; kind: 'text' | 'pdf' | 'example'; pages?: SourcePage[] }
  settings: { density: Density; composition: Composition; brief?: PresentationBrief }
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
  origin?: ContentOrigin
  requirements?: string[]
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
  brief?: PresentationBrief
}
export interface PdfExtraction {
  text: string
  pages: SourcePage[]
  warnings: string[]
  name: string
}
