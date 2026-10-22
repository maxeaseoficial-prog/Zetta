import type { ChartConfig, Deck, Slide } from '../types'
import { serializeChartInput } from './chartData'

const source = 'Dados fictícios para experimentar o Zetta'
const examples: { title: string; description: string; chart: ChartConfig }[] = [
  {
    title: 'Compare resultados com clareza.',
    description:
      'Colunas com três séries: receita, despesas e lucro. Os números abaixo são fictícios.',
    chart: {
      type: 'bar',
      seriesName: 'Receita',
      unit: 'R$',
      source,
      animate: true,
      showValues: false,
      data: [
        { label: 'Jan', value: 120000 },
        { label: 'Fev', value: 138000 },
        { label: 'Mar', value: 152000 },
        { label: 'Abr', value: 167000 },
        { label: 'Mai', value: 184000 },
        { label: 'Jun', value: 210000 },
      ],
      additionalSeries: [
        { name: 'Despesas', values: [94000, 104000, 111000, 118000, 129000, 143000] },
        { name: 'Lucro', values: [26000, 34000, 41000, 49000, 55000, 67000] },
      ],
    },
  },
  {
    title: 'Dê espaço aos nomes.',
    description: 'Barras horizontais tornam a comparação entre canais fácil de ler.',
    chart: {
      type: 'horizontalBar',
      seriesName: 'Oportunidades',
      unit: '',
      source,
      animate: true,
      showValues: true,
      data: [
        { label: 'Busca orgânica', value: 84 },
        { label: 'Indicações', value: 67 },
        { label: 'Redes sociais', value: 52 },
        { label: 'Eventos', value: 38 },
        { label: 'Prospecção', value: 27 },
      ],
    },
  },
  {
    title: 'Conte a evolução ao longo do tempo.',
    description: 'Linhas conectam períodos consecutivos. Os dados continuam editáveis.',
    chart: {
      type: 'line',
      seriesName: 'Clientes',
      unit: '',
      source,
      animate: true,
      showValues: true,
      data: [
        { label: 'Jan', value: 48 },
        { label: 'Fev', value: 63 },
        { label: 'Mar', value: 59 },
        { label: 'Abr', value: 81 },
        { label: 'Mai', value: 96 },
        { label: 'Jun', value: 112 },
      ],
    },
  },
  {
    title: 'Mostre oscilações sem esconder quedas.',
    description: 'O gráfico de área preserva a linha de zero e os valores negativos.',
    chart: {
      type: 'area',
      seriesName: 'Saldo',
      unit: 'R$',
      source,
      animate: true,
      showValues: true,
      data: [
        { label: 'Jan', value: 8000 },
        { label: 'Fev', value: 14000 },
        { label: 'Mar', value: -6000 },
        { label: 'Abr', value: 10000 },
        { label: 'Mai', value: 16000 },
        { label: 'Jun', value: 22000 },
      ],
    },
  },
  {
    title: 'Cada parte tem seu lugar.',
    description:
      'Pizza representa partes de um mesmo total. Esta distribuição de exemplo soma 100%.',
    chart: {
      type: 'pie',
      seriesName: 'Distribuição',
      unit: '%',
      source,
      animate: true,
      showValues: true,
      data: [
        { label: 'Produto', value: 40 },
        { label: 'Operação', value: 25 },
        { label: 'Marketing', value: 20 },
        { label: 'Pessoas', value: 15 },
      ],
    },
  },
  {
    title: 'Uma visão clara da composição.',
    description: 'Rosca usa uma única série, com valores não negativos e total maior que zero.',
    chart: {
      type: 'donut',
      seriesName: 'Clientes',
      unit: '',
      source,
      animate: true,
      showValues: true,
      data: [
        { label: 'Plano Essencial', value: 96 },
        { label: 'Plano Equipe', value: 64 },
        { label: 'Plano Negócio', value: 48 },
        { label: 'Plano Empresa', value: 32 },
      ],
    },
  },
]

export function createChartsDemoDeck(): Deck {
  const now = new Date().toISOString()
  const slides: Slide[] = [
    {
      id: crypto.randomUUID(),
      title: 'Números que contam uma história.',
      eyebrow: 'ZETTA · LABORATÓRIO DE GRÁFICOS',
      layout: 'cover',
      blocks: [
        {
          id: crypto.randomUUID(),
          type: 'text',
          content:
            'Seis visuais. Dados editáveis.\nMovimento na apresentação.\n\nTodos os números deste exemplo são fictícios.',
        },
        {
          id: crypto.randomUUID(),
          type: 'image',
          content: '',
          image: {
            alt: 'Composição geométrica decorativa',
            illustration: 'growth',
            fit: 'cover',
            position: 50,
            seed: 4,
          },
        },
      ],
      notes:
        'Apresentação de demonstração. Os dados são fictícios e não representam uma empresa real.',
      sourcePages: [],
    },
    ...examples.map((example) => ({
      id: crypto.randomUUID(),
      title: example.title,
      eyebrow: 'DADOS FICTÍCIOS · EDITE PARA USAR',
      layout: 'chart' as const,
      blocks: [
        {
          id: crypto.randomUUID(),
          type: 'chart' as const,
          content: '',
          chart: structuredClone(example.chart),
        },
      ],
      notes:
        example.description + '\n\nFonte: ' + source + '\n\n' + serializeChartInput(example.chart),
      sourcePages: [],
    })),
  ]
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title: 'Laboratório de gráficos — Zetta',
    createdAt: now,
    updatedAt: now,
    themeId: 'minimal',
    accent: '#2563EB',
    slides,
    source: {
      name: source,
      kind: 'example',
      text: examples
        .map(
          (example) =>
            example.title + '\n' + example.description + '\n' + serializeChartInput(example.chart),
        )
        .join('\n\n'),
    },
    settings: { density: 'balanced', composition: 'rich' },
  }
}
