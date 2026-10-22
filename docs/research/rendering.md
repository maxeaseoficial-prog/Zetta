# Zetta V3 — triagem de renderização, diagramas e PDF

Pesquisa em 22/10/2026. Esta etapa foi de leitura: nenhum arquivo do aplicativo foi alterado e nenhum pacote foi instalado. Foi baixado apenas o arquivo oficial das fontes Liberation para inspeção, sem instalação no sistema. A prova de PDF no navegador ainda não foi executada nesta etapa.

## 1. Base inspecionada

- Zetta: commit `4f444c289d9eeb584be66c9949ef264739b7686c`; árvore limpa na primeira leitura.
- Dependências efetivamente instaladas: `echarts@6.1.0`, `jspdf@4.2.1`.
- `src/components/SlideCanvas.tsx`: SVG próprio 1280 × 720; imagens raster incorporadas; gráficos ECharts como `<image href="data:image/svg+xml…">`; seleção e edição externas ao conteúdo exportado.
- `src/lib/exportPdf.ts`: `renderToStaticMarkup(SlideCanvas)` → SVG → canvas 2560 × 1440 → PNG → jsPDF, uma página 960 × 540 pt por slide. Portanto, o PDF atual não contém texto pesquisável.
- `src/lib/themes.ts` e `SlideCanvas.tsx`: títulos Arial ou Georgia; textos comuns e gráficos Arial. Essas famílias vêm do ambiente do navegador, não de arquivos empacotados pelo Zetta.
- Os pacotes Fontsource existentes são DM Sans e Manrope para a interface; contêm fontes web WOFF/WOFF2 e licença OFL, mas não oferecem diretamente os TTF usados pelo mecanismo de incorporação do jsPDF.
- Carregamento antecipado confirmado: `Home.tsx → SlideCanvas.tsx → chartRenderer.ts → echarts`; `generator.ts → getChartWarnings` também importa `chartRenderer.ts`, que registra o motor no nível do módulo. Mover apenas o componente com `React.lazy` não resolve esse segundo caminho.
- A exportação já é importada dinamicamente em `App.tsx`. Não precisamos trocar jsPDF nem acrescentar backend.

## 2. Matriz de decisão

| Projeto / versão examinada                                                                                                                                       | Necessidade e evidência concreta                                                                                                                                                                                  | Licença                                                                        | Runtime / dependências / custo                                                                                                                               | Compatibilidade e decisão                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mermaid: pacote 12.2.0 no commit `6d8921f94f9a12b76586eddcf45a566080d4767e`, 19/10/2026                                                                          | `packages/mermaid/src/mermaidAPI.ts` implementa parse/render; `diagrams/timeline/timelineRenderer.ts` mede e distribui tarefas; `rendering-util/createText.ts` distingue texto SVG de HTML em foreignObject       | MIT, LICENSE do commit lido                                                    | Navegador com DOM; dependências incluem D3, parsers, Dagre/ELK, Cytoscape, DOMPurify e outras. Não exige API paga. Não foi instalado nem seu peso foi medido | **Adiar biblioteca; usar SVG próprio para os quatro blocos.** Mermaid resolveria topologias mais complexas, mas aumenta superfície de dependências, sintaxe e regras de enquadramento. Editabilidade viria do JSON de itens, não do SVG retornado. A variante com HTML labels exige cuidado adicional no PDF |
| svg2pdf.js: release **2.8.1**, commit de tag `a16285d912e6edf5e1300e8d9f5beb0ea7d04569`; HEAD de pesquisa `664ed8668d3765061a409714e9a82f940f2dbd52`, 21/10/2026 | `src/nodes/text.ts` chama `pdf.text`; `src/nodes/image.ts` reconhece SVG em data URI, cria DOMParser e processa os nós recursivamente; `src/parse.ts` tem text, paths, shapes, gradients, clipping e SVG aninhado | MIT; LICENSE lido. Preservar aviso de yWorks e demais titulares incluídos      | Navegador com DOM real; README informa que JSDOM não basta. Dependências: cssesc, font-family-papandreou, specificity, svgpath; peer jsPDF `^4.0.0           |                                                                                                                                                                                                                                                                                                              | ^3.0.0 |     | ^2.0.0`. Não exige API/servidor/custo obrigatório | **Adotar somente após prova pequena.** Encaixe forte com o SVG atual, inclusive os gráficos aninhados; suporte é parcial, não universal. Carregar somente ao exportar no modo vetorial |
| jsPDF: instalado **4.2.1**, tag `v4.2.1` em `4562ce8aa35bd5ecd98cd5e262e3da2af96476f6`                                                                           | README e `src/modules/ttfsupport.js`: texto, fontes TTF via VFS/addFont; API atual já usada para imagens, páginas e download                                                                                      | MIT; LICENSE da tag lido                                                       | Navegador; já instalado; não precisa de outro exportador. Conversão e incorporação usam CPU/memória locais                                                   | **Manter.** SVG2PDF acrescenta a conversão vetorial. `addSvgAsImage`/canvas não atendem ao requisito de texto pesquisável                                                                                                                                                                                    |
| Apache ECharts: instalado **6.1.0**                                                                                                                              | Módulo atual usa core + Bar/Line/Pie + Grid/Legend + LabelLayout + SVG. `renderToSVGString` produz SVG estático e CSS de entrada; instância descartada em finally                                                 | Apache-2.0, já atribuída no projeto; avisos de ZRender e trechos D3 existentes | Navegador; sem API/servidor/WASM. Trabalho síncrono de layout apenas quando um gráfico é renderizado                                                         | **Manter o único motor atual.** Extrair helpers puros e importar o engine sob demanda. Reutilizar a saída estática no PDF. Não incorporar Mermaid para gráficos quantitativos                                                                                                                                |

### Evidência versus inferência

- Confirmados no código: caminho de rasterização atual, imports antecipados, suporte a nós de texto e SVG aninhado no svg2pdf, arquivos/licenças/peer range, formato TTF esperado no jsPDF.
- Descrito na documentação: propósito do Mermaid, exigência de DOM real e limites do svg2pdf, integração de fontes no jsPDF.
- Ainda não verificados nesta etapa: fidelidade do SVG da Zetta no svg2pdf, seleção/extração de acentos no PDF resultante, tamanho final dos chunks, tempos no navegador, tolerância visual em todas as composições.
- A prova anterior de ECharts confirmou animação real, quadro final idêntico ao estático e PDF raster com os seis tipos. Isso não comprova, por si só, a nova exportação vetorial.

## 3. Contrato dos quatro blocos — alinhado com root

```ts
type DiagramType = 'process' | 'timeline' | 'comparison' | 'metrics'
interface DiagramItem {
  id: string
  title: string
  description: string
  label?: string
  value?: string
}
interface DiagramConfig {
  type: DiagramType
  items: DiagramItem[]
  source: string
}
// SlideBlock.type recebe 'diagram'; SlideBlock.diagram?: DiagramConfig
```

Implementação proposta: `src/lib/diagramLayout.ts` puro e `src/components/DiagramBlock.tsx`. A função de layout calcula retângulos e linhas de texto; o componente usa exatamente esse resultado. `getDiagramWarnings(diagram, width, height, fontFamily?)` deve derivar do mesmo plano, sem lógica alternativa.

- Processo: sequência de cartões numerados com conectores. Até seis itens. Mudar entre linha e grade conforme área disponível, mantendo ordem.
- Linha do tempo: marcos com `label` exibido como data/rótulo informado. Não interpretar datas vagas nem reordenar silenciosamente. Até seis itens.
- Comparação: duas colunas para os dois itens. Mais itens produzem aviso, não desaparecem.
- Indicadores: até quatro cartões para leitura confortável; `value` é string literal, preservando moeda, percentual, traço ou outro conteúdo informado. Sem cálculo nem inferência de melhora/piora.
- Título do bloco continua em `block.content`; `source` recebe área própria medida. Todos os itens continuam no documento. Texto longo gera aviso de ampliar/dividir/reorganizar; não usar clipping de conteúdo nem fonte arbitrariamente minúscula.
- Nenhuma entrada de código Mermaid ou SVG arbitrário. Campos validados → elementos React SVG escapados.
- Seleção continua no bloco inteiro; edição de itens acontece no painel. Duplicação, histórico e backup usam o JSON estruturado.

## 4. Contrato de desempenho

Separação proposta, sem segundo renderer:

```ts
// chartLayout.ts: sem imports de echarts
export function getChartWarnings(chart: ChartConfig, width: number, height: number): string[]
export function formatChartValue(value: number, unit?: string): string
// Também contém o modelo puro de domínio, dimensões, rótulos e posições.

// chartRenderer.ts: engine ECharts, carregado dinamicamente
export function renderChartSvg(chart: ChartConfig, options: ChartRenderOptions): ChartSnapshot

// chartRuntime.ts: sem import estático do engine
export function loadChartRenderer(): Promise<typeof import('./chartRenderer')>
export function getLoadedChartRenderer(): typeof import('./chartRenderer') | null
```

O componente de gráfico monta um estado de carregamento e pede o módulo apenas se realmente houver gráfico no slide visível. A promise deve ser compartilhada entre instâncias; erro deve aparecer com ação de tentar novamente. `renderChartSvg` permanece síncrono dentro do engine para testes e SSR estático.

`generator.ts`, avisos e UI importam o módulo puro. O PDF testa se existe gráfico no deck e aguarda preload antes de `renderToStaticMarkup`; falha de carregamento interrompe a exportação, nunca salva gráfico vazio.

Root confirmou que carregar o engine para uma miniatura da home que realmente contém gráfico é aceitável. Home/apresentação sem gráfico não deve carregar ECharts. Não criar renderizador simplificado alternativo. Animações/cache/dispose continuam como antes.

Verificação necessária: build com inventário de chunks e requests do navegador; home vazia e deck só de texto sem chunk ECharts; primeiro gráfico carrega uma vez; deck com vários gráficos reutiliza o módulo; exportação aguarda o mesmo módulo. Medir no ambiente de teste, sem extrapolar desempenho para o Mac do usuário.

## 5. Fontes portáveis — inspeção realizada

Fonte proposta para os novos perfis: **Liberation 2.1.5**, release oficial de 30/09/2021. Commit do repositório examinado: `49e1358e4017577429c9f8c39a3e6e879093264e`. Fonte do download: URL anexada à release oficial, não um redistribuidor.

Arquivo oficial `liberation-fonts-ttf-2.1.5.tar.gz`; SHA-256 `7191c669bf38899f73a2094ed00f7b800553364f90e2637010a69c0e268f25d0`.

O LICENSE dentro do próprio arquivo confirma SIL Open Font License 1.1 e permite incorporação/redistribuição preservando o aviso. Os binários não serão modificados nem renomeados internamente.

| Arquivo                     |  Bytes | SHA-256                                                          |
| --------------------------- | -----: | ---------------------------------------------------------------- |
| LiberationSans-Regular.ttf  | 410712 | 76d04c18ea243f426b7de1f3ad208e927008f961dc5945e5aad352d0dfde8ee8 |
| LiberationSans-Bold.ttf     | 414456 | 788abee4c806d660e8aee46689dd8540cd4bb98da03dcc9d171ce3efd99a9173 |
| LiberationSerif-Regular.ttf | 393576 | 058ea80864aef09a23f45cbec2bb5400bc3dfbdea01c3f10538a21fcb497fb74 |
| LiberationSerif-Bold.ttf    | 370096 | d754ba427cfe0bca54ae052384baa8f842da5bd6550ad4da024ac441e7a7d5ce |

FontTools leu os quatro binários: `OS/2.fsType=0`; todos os glifos de `ação, São Paulo, R$ 1.234,56, -8,5%, € 24,99, 0,10000000000000002` estão presentes. Isso verifica cobertura, não substitui a futura prova de incorporação e extração no PDF.

Contrato coordenado com agente marca:

```ts
type BrandFontId = 'sans' | 'serif'
// fonts.ts, um único mapeamento
fontFamilyFor('sans') // 'Liberation Sans'
fontFamilyFor('serif') // 'Liberation Serif'
ensureBrandFonts(id): Promise<void>
```

Carregar apenas o par da família usada (aprox. 825 KB sans ou 764 KB serif, bytes TTF brutos medidos). Usar os mesmos bytes no FontFace do navegador e no `addFileToVFS`/`addFont` do jsPDF. Aguardar carregamento antes de medir layout, exportar ou encerrar a prévia de marca. Fontes dos gráficos também devem seguir o resolvedor quando houver marca.

Legado sem `brand` mantém a família anterior no editor. Não trocar Arial/Georgia silenciosamente. `svg2pdf` possui alias Arial → Helvetica; Georgia sem registro acaba em Times/serif: **isso é substituição e não fidelidade garantida**. A prova deve testar primeiro a família portável; a UI precisa distinguir exportação pesquisável com fonte suportada e exportação de imagem para preservar estritamente um documento legado que não seja aprovado para conversão. Uma eventual substituição no PDF precisa ser declarada; não é migração automática do documento.

## 6. Prova pequena e contrato do PDF

Dependência candidata: `svg2pdf.js@2.8.1`, instalada pelo root após o diagnóstico. Importação dinâmica apenas ao exportar no modo vetorial. A skill PDF foi lida; inspeção visual e extração de texto serão provas separadas.

Prova mínima: uma página representativa 16:9 com título e parágrafo português, regular/negrito, alinhamento, quebra de linha, fonte de dados, símbolo monetário e número preciso; um gráfico ECharts estático em data URI; formas com transparência; fotografia raster recortada. Usar os mesmos elementos do `SlideCanvas`, sem montar uma página de PDF paralela.

Pipeline proposto:

1. Resolver aparência efetiva do slide (`Slide.appearance` antes da aparência do deck), pré-carregar família e engine apenas quando necessários.
2. Manter preparação de imagens, dimensões, verificação de overflow e normalização PNG/JPEG existentes.
3. `renderToStaticMarkup(SlideCanvas)` com seleção ausente e animações desativadas.
4. Parsear apenas o SVG produzido pelo aplicativo; criar container DOM temporário fora da tela para medições necessárias, removendo-o em finally.
5. Registrar fontes estáticas no jsPDF antes da conversão. Converter com `svg2pdf(element,pdf,{x:0,y:0,width:960,height:540,loadExternalStyleSheets:false,loadImages:/^data:image\//})`.
6. Renderizar páginas sequencialmente, atualizar progresso e ceder o event loop entre páginas. Não paralelizar todas as páginas e fontes em memória.
7. Só salvar quando todas as páginas tiverem sido produzidas com sucesso.

O caminho de `src/nodes/image.ts` de svg2pdf 2.8.1 converte SVG aninhado recursivamente; imagens PNG/JPEG usam `addImage`. Isso permite que o gráfico permaneça vetorial e os textos dos eixos sejam pesquisáveis, **desde que a prova confirme o SVG específico do ECharts**. Não é necessário achatar o gráfico em PNG nem injetar HTML arbitrário no editor.

API sugerida para revisão do root:

```ts
type PdfExportMode = 'searchable' | 'image'
interface PdfExportReport {
  mode: PdfExportMode
  pageCount: number
  rasterizedElements: { slide: number; reason: string }[]
  warnings: string[]
}
exportPdf(deck, onProgress?, options?: { mode?: PdfExportMode }): Promise<PdfExportReport>
```

Preservar o pipeline raster atual como modo explícito. Não capturar uma exceção do conversor e declarar sucesso pesquisável após rasterizar tudo. Caso o conversor falhe depois de escrever conteúdo, abortar esse PDF e oferecer nova exportação em imagem; evitar continuar em documento com estado gráfico parcialmente alterado. Se um elemento tiver fallback raster deliberado e comprovado, o relatório deve informar qual elemento/slide perdeu seleção de texto. Foto raster normal não é falha.

### Critérios separados da prova

- **Texto:** `pdftotext` e PDF.js extraem os trechos e valores esperados; acentos/cedilha/R$/€/% e precisão mantidos; validar também textos dos gráficos aninhados.
- **Fontes:** `pdffonts` indica fontes incorporadas; inspecionar ToUnicode e glifos, sem depender das fontes do host.
- **Vetores:** página sem foto não pode consistir em uma imagem do slide; conferir paths/texto nos objetos/operadores. Na página com foto, a imagem deve corresponder à fotografia, não à página inteira.
- **Fidelidade:** renderizar com Poppler e comparar com a captura estática do editor. Conferir recortes, alinhamento, transparência, legendas e limites; antialiasing pode diferir, por isso igualdade exata de pixels não é a única medida.
- **Documento:** uma página por slide, 960 × 540 pt, sem seleção/editor; exportação interrompida para overflow; download só ao final.
- **Desempenho:** jsPDF/svg2pdf/fontes fora do carregamento inicial; medir tempo e memória observados no ambiente local, sem alegar ganho no Mac não testado.

## 7. Riscos concretos e limites

1. Fontes substituídas mudam letras e medidas. Não confundir texto extraível com fidelidade tipográfica.
2. O parser do svg2pdf ignora nós não suportados como VoidNode; ausência de exceção não garante conteúdo completo. Preflight e inspeção visual são necessários. Zetta já usa um subconjunto controlado sem foreignObject, filtros ou SVG importado livremente.
3. A implementação de imagem raster do conversor pode capturar erro e emitir console.warn. A preparação de imagens do Zetta deve continuar bloqueando imagens inválidas antes da conversão.
4. Fontes aninhadas nos gráficos precisam do mesmo registro no jsPDF e da mesma família na medição/renderização. Carregar somente a fonte do título não basta.
5. Diagramas com muitos itens continuam exigindo espaço. Preservar dados e expor aviso; não omitir item para exportar.
6. Tudo proposto continua executando no navegador do usuário. Hospedagem estática e importação dinâmica não transferem CPU para um servidor.

## 8. Fontes primárias e arquivos examinados

- Mermaid pacote e licença: https://github.com/mermaid-js/mermaid/blob/6d8921f94f9a12b76586eddcf45a566080d4767e/packages/mermaid/package.json ; https://github.com/mermaid-js/mermaid/blob/6d8921f94f9a12b76586eddcf45a566080d4767e/LICENSE
- Mermaid API/texto: https://github.com/mermaid-js/mermaid/blob/6d8921f94f9a12b76586eddcf45a566080d4767e/packages/mermaid/src/mermaidAPI.ts ; https://github.com/mermaid-js/mermaid/blob/6d8921f94f9a12b76586eddcf45a566080d4767e/packages/mermaid/src/rendering-util/createText.ts
- Mermaid timeline: https://github.com/mermaid-js/mermaid/blob/6d8921f94f9a12b76586eddcf45a566080d4767e/packages/mermaid/src/diagrams/timeline/timelineRenderer.ts
- Mermaid uso: https://github.com/mermaid-js/mermaid/blob/6d8921f94f9a12b76586eddcf45a566080d4767e/packages/mermaid/src/docs/config/usage.md
- SVG2PDF release: https://github.com/yWorks/svg2pdf.js/releases/tag/v2.8.1
- SVG2PDF imagem aninhada: https://github.com/yWorks/svg2pdf.js/blob/a16285d912e6edf5e1300e8d9f5beb0ea7d04569/src/nodes/image.ts
- SVG2PDF tipos: https://github.com/yWorks/svg2pdf.js/blob/a16285d912e6edf5e1300e8d9f5beb0ea7d04569/types.d.ts
- SVG2PDF README/dep/licença examinados no HEAD: https://github.com/yWorks/svg2pdf.js/blob/664ed8668d3765061a409714e9a82f940f2dbd52/README.md ; https://github.com/yWorks/svg2pdf.js/blob/664ed8668d3765061a409714e9a82f940f2dbd52/package.json ; https://github.com/yWorks/svg2pdf.js/blob/664ed8668d3765061a409714e9a82f940f2dbd52/LICENSE
- SVG2PDF parser e texto: https://github.com/yWorks/svg2pdf.js/blob/664ed8668d3765061a409714e9a82f940f2dbd52/src/parse.ts ; https://github.com/yWorks/svg2pdf.js/blob/664ed8668d3765061a409714e9a82f940f2dbd52/src/nodes/text.ts
- SVG2PDF fontes/aliases: https://github.com/yWorks/svg2pdf.js/blob/664ed8668d3765061a409714e9a82f940f2dbd52/src/utils/fonts.ts
- SVG2PDF testes existentes, não executados aqui: https://github.com/yWorks/svg2pdf.js/blob/v2.8.1/test/images/image-svg-urls.svg ; https://github.com/yWorks/svg2pdf.js/blob/v2.8.1/test/custom-fonts/custom-fonts.spec.ts
- jsPDF README/licença/TTF: https://github.com/parallax/jsPDF/blob/4562ce8aa35bd5ecd98cd5e262e3da2af96476f6/README.md ; https://github.com/parallax/jsPDF/blob/4562ce8aa35bd5ecd98cd5e262e3da2af96476f6/LICENSE ; https://github.com/parallax/jsPDF/blob/4562ce8aa35bd5ecd98cd5e262e3da2af96476f6/src/modules/ttfsupport.js
- Liberation release/binários/licença: https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5 ; https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz ; https://github.com/liberationfonts/liberation-fonts/blob/49e1358e4017577429c9f8c39a3e6e879093264e/LICENSE
- ECharts oficial, referência da integração existente: https://echarts.apache.org/handbook/en/how-to/cross-platform/server/ ; https://echarts.apache.org/handbook/en/basics/import/
