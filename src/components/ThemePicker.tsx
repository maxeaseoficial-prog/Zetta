import { Check } from 'lucide-react'
import { THEMES, getTheme } from '../lib/themes'
import { SlideCanvas } from './SlideCanvas'
import type { Slide, ThemeId } from '../types'

export const PREVIEW_SLIDE: Slide = {
  id: 'theme-preview',
  title: 'Boas ideias merecem espaço.',
  eyebrow: 'UM NOVO PONTO DE VISTA',
  layout: 'cover',
  notes: '',
  sourcePages: [],
  blocks: [
    { id: 'preview-text', type: 'text', content: 'Dê forma ao que você quer compartilhar.' },
    {
      id: 'preview-image',
      type: 'image',
      content: '',
      image: {
        alt: 'Composição geométrica',
        illustration: 'orbit',
        fit: 'cover',
        position: 50,
        seed: 42,
      },
    },
  ],
}
export function ThemePicker({
  value,
  onChange,
  compact = false,
}: {
  value: ThemeId
  onChange: (id: ThemeId) => void
  compact?: boolean
}) {
  return (
    <div className={'theme-grid' + (compact ? ' compact' : '')}>
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          className={'theme-choice ' + (value === theme.id ? 'is-active' : '')}
          onClick={() => onChange(theme.id)}
          aria-pressed={value === theme.id}
        >
          <div className="theme-preview">
            <SlideCanvas slide={PREVIEW_SLIDE} theme={getTheme(theme.id)} accent={theme.accent} />
            {value === theme.id && (
              <span className="theme-check">
                <Check size={13} />
              </span>
            )}
          </div>
          <span className="theme-label">
            {theme.name}
            <span className="theme-dots">
              <i style={{ background: theme.background }} />
              <i style={{ background: theme.foreground }} />
              <i style={{ background: theme.accent }} />
            </span>
          </span>
          {!compact && <span className="theme-description">{theme.description}</span>}
        </button>
      ))}
    </div>
  )
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const colors = ['#2563EB', '#0284C7', '#0891B2', '#059669', '#D97706', '#E11D48', '#334155']
  return (
    <div className="color-picker">
      {colors.map((color) => (
        <button
          key={color}
          className={'color-dot ' + (value.toUpperCase() === color.toUpperCase() ? 'selected' : '')}
          style={{ background: color }}
          onClick={() => onChange(color)}
          aria-label={'Usar cor ' + color}
          aria-pressed={value.toUpperCase() === color.toUpperCase()}
        >
          {value.toUpperCase() === color.toUpperCase() && <Check size={15} />}
        </button>
      ))}
      <label className="custom-color" title="Cor personalizada">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Cor personalizada"
        />
        <span>+</span>
      </label>
    </div>
  )
}
