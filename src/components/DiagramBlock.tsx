import type { DiagramConfig } from '../types'
import { buildDiagramLayout, type DiagramText } from '../lib/diagramLayout'

export interface DiagramBlockProps {
  diagram: DiagramConfig
  title: string
  rect: { x: number; y: number; w: number; h: number }
  family: string
  colors: {
    bg: string
    fg: string
    muted: string
    accent: string
    surface: string
    ink: string
    tint: string
  }
}

export function DiagramBlock({ diagram, title, rect, family, colors }: DiagramBlockProps) {
  const plan = buildDiagramLayout(diagram, rect.w, rect.h, family, title)
  const drawText = (field: DiagramText, key: string) => (
    <text
      key={key}
      fill={
        field.kind === 'label' || field.kind === 'value'
          ? colors.ink
          : field.kind === 'source' || field.kind === 'description'
            ? colors.muted
            : colors.fg
      }
      fontFamily={family}
      fontSize={field.size}
      fontWeight={field.weight}
    >
      {field.lines.map((line, index) => (
        <tspan key={index} x={field.x} y={field.y + field.size + index * field.lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  )
  return (
    <g transform={`translate(${rect.x} ${rect.y})`} data-diagram-type={diagram.type}>
      <rect
        width={Math.max(1, rect.w)}
        height={Math.max(1, rect.h)}
        rx={18}
        fill={colors.surface}
      />
      {plan.heading && drawText(plan.heading, 'heading')}
      {plan.cards.map((card) => (
        <g key={card.item.id} data-diagram-item={card.item.id}>
          <rect
            x={card.x}
            y={card.y}
            width={Math.max(1, card.w)}
            height={Math.max(1, card.h)}
            rx={13}
            fill={colors.bg}
            stroke={colors.accent}
            strokeOpacity={0.16}
          />
          {diagram.type === 'comparison' && (
            <rect
              x={card.x}
              y={card.y + 14}
              width={3}
              height={Math.max(1, card.h - 28)}
              rx={1.5}
              fill={colors.accent}
            />
          )}
          {diagram.type === 'metrics' && (
            <rect x={card.x + 18} y={card.y} width={32} height={3} rx={1.5} fill={colors.accent} />
          )}
          {(diagram.type === 'process' || diagram.type === 'timeline') && (
            <>
              <circle cx={card.x + 31} cy={card.y + 31} r={15} fill={colors.tint} />
              {diagram.type === 'process' ? (
                <text
                  x={card.x + 31}
                  y={card.y + 36}
                  textAnchor="middle"
                  fill={colors.ink}
                  fontSize={14}
                  fontWeight={700}
                  fontFamily={family}
                >
                  {card.index + 1}
                </text>
              ) : (
                <circle cx={card.x + 31} cy={card.y + 31} r={5} fill={colors.accent} />
              )}
              {card.index % plan.columns < plan.columns - 1 &&
                card.index < plan.cards.length - 1 && (
                  <path
                    d={`M${card.x + card.w + 3} ${card.y + 31}h12m-4 -4 4 4-4 4`}
                    fill="none"
                    stroke={colors.accent}
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
            </>
          )}
          {card.texts.map((field, index) => drawText(field, `${card.item.id}-${index}`))}
        </g>
      ))}
      {plan.source && drawText(plan.source, 'source')}
    </g>
  )
}
