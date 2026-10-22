# Zetta — triagem de referências e contratos de composição/narrativa

Inspeção em 22/10/2026, somente leitura. Orientação do usuário lida em `Texto colado(20261022-035001).txt`. Código local conferido no commit `4f444c289d9eeb584be66c9949ef264739b7686c`, sem alterações locais no momento da leitura. Repositórios públicos lidos pelo conector GitHub, conta indicada pelo root. Nenhum candidato foi instalado ou executado. As conclusões abaixo distinguem implementação observada, documentação e proposta para o Zetta.

## 1. Seleção recomendada

**Implementação própria e curta sobre o documento atual do Zetta.** Usar `presentation-ai` como referência de prévias de layout aplicadas sobre o mesmo conteúdo; usar `data-formulator` como referência de procedência, planos explícitos e comparação entre origem e resultado. Não transportar os aplicativos, runtimes, bancos de dados ou agentes para entregar composição e roteiro por regras.

| Repositório e commit observado                                                                                     | Licença conferida                                                                                                                          | Processamento e requisitos                                                                                                                                                                                                | Evidência principal                                                                                                     | Compatibilidade e decisão                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| allweonedev/presentation-ai — `43fe74abd5676dbbea52b8cd66c43fb3b931b5c1`, main, 05/06/2026                         | MIT, copyright ALLWEONE Team. O aviso deve acompanhar código reutilizado. A licença do app não substitui as licenças de suas dependências. | Editor e exportador PPTX no navegador; rotas Next.js, PostgreSQL/Prisma e agentes no servidor; geração por OpenAI ou processo Ollama/LM Studio separado. Recursos remotos adicionais usam credenciais.                    | `LayoutPreviewSheet.tsx`, `utils/parser.ts`, `model-picker.ts`, `domToPptxConverter.ts`, `prisma/schema.prisma`         | **Referência para editor, alternativas de layout e revisão.** Fonte Plate/JSON editável, mas exige adaptador para `Deck`. PPTX tem elementos nativos e imagens; não é prova de fidelidade integral. PDF não implementado no caminho de exportação inspecionado. Não incorporar o pacote inteiro.                                 |
| microsoft/data-formulator — `5477f0e236426dc8f74a498ec400414fba7fbc0f`, main, 15/08/2026; `pyproject.toml` 0.8.0b1 | MIT, copyright Microsoft. Preservar aviso se houver cópia substancial. Marcas/logos não são parte da identidade a copiar.                  | Frontend React/Vite com diversos motores de visualização; backend Flask/Python 3.11+, pandas, DuckDB, NumPy, LiteLLM e conectores. Transformações executam Python no host do backend. Modelos remotos ou Ollama separado. | `ComponentType.tsx`, `dataOperations/models.ts`, `agents/client_utils.py`, `sandbox/local_sandbox.py`, `ReportView.tsx` | **Referência para conferência e procedência; adiar a plataforma.** Dados, derivações e visualizações são estruturados, mas não constituem um editor de slides. Relatórios embutem imagens de gráficos e usam impressão do navegador para PDF. Não resolve automaticamente nosso PDF 16:9 nem alivia o Mac quando instalado nele. |
| presenton/presenton — `4e9d853cfac27e5330e62087dd9371d8b18e1534`                                                   | Apache-2.0 do app; ressalva do pacote de exportação separado permanece                                                                     | Next.js + FastAPI/SQL; modelos/serviços configurados; exportador Node separado                                                                                                                                            | Relatório anterior e HEAD reconfirmado                                                                                  | **Referência.** Contrato de elementos/templates útil; export-core não é dependência de navegador nem tem licença identificada no tarball examinado.                                                                                                                                                                              |
| barun-saha/slide-deck-ai — `9fa68d14e89c02c48be1bb22c6db0a537f65e029`                                              | MIT                                                                                                                                        | Python/Streamlit, LiteLLM/Ollama, python-pptx; Pexels opcional com chave                                                                                                                                                  | Relatório anterior e HEAD reconfirmado                                                                                  | **Referência; PPTX adiado.** Não introduzir Python apenas para reproduzir o fluxo que o Zetta já tem.                                                                                                                                                                                                                            |
| Anionex/banana-slides — `023cd54e0c28a116c662f6abdaf60a8dd5a41037`                                                 | AGPL-3.0                                                                                                                                   | Flask/React; geração de imagens e reconstrução editável com provedores; MinerU em parte da importação                                                                                                                     | Relatório anterior e HEAD reconfirmado                                                                                  | **Referência de fluxo visual.** Não migrar slides estruturados para imagens seguidas de reconstrução por OCR. Não copiar módulos sem compatibilizar a distribuição com a licença.                                                                                                                                                |

Os três HEADs da análise anterior **não mudaram**. A leitura aprofundada anterior permanece válida no mesmo objeto Git; foi reaproveitada no [relatório anterior](../presentation-references.md). Não se atribuiu execução nova a essa reconfirmação.

## 2. `presentation-ai`: o que o código permite afirmar

### Editor, layouts e persistência

`PlateSlide` possui `content: PlateNode[]`, imagem raiz opcional, enquadramento, estilo, fontes e proporção. O modelo Prisma armazena `Presentation.content` JSON, tema, roteiro, personalização, resultados de busca e trechos selecionados; o banco é PostgreSQL. Portanto, existe documento estruturado editável, e não apenas uma imagem final.

`LayoutPreviewSheet.tsx` cria slides temporários a partir do elemento atual, usa o editor estático da própria apresentação para desenhar a prévia e oferece aplicação e navegação por teclado. Esse padrão é útil: as variantes devem usar o mesmo renderer e documento que serão persistidos. O Zetta não precisa importar Plate, Zustand, Prisma ou o catálogo de XML para entregar três ou quatro variantes seguras sobre seus próprios blocos.

O catálogo `layout-catalog.ts` orienta prompts com estruturas XML (colunas, listas, comparações, processos etc.). Ele é **referência de representação**, não um algoritmo comprovado de leitura semântica de qualquer texto. Nada nessa leitura demonstra que copiar o catálogo produza automaticamente melhores roteiros.

### Modelos e custo de execução

`src/app/api/presentation/outline/route.ts` recebe uma seleção de provedor e chama `ensureModelIsReady`/`modelPicker` no caminho Next.js. `src/lib/model-picker.ts` confirma OpenAI com chave e endpoints locais Ollama/LM Studio. No caso Ollama, há chamada a `/api/pull` quando o modelo selecionado não está instalado. Esse comportamento **não deve ser copiado** para o fluxo normal do Zetta: o usuário exige evitar download/inicialização automática de modelos e não sobrecarregar o dispositivo.

Inferência decorrente dos caminhos lidos: um endpoint `localhost` usado em uma rota de servidor corresponde ao host dessa rota; publicar o frontend não cria uma conexão automática entre um servidor hospedado e o Ollama instalado no Mac. Uma eventual arquitetura remota precisa de serviço, rede, autenticação e destino dos dados definidos separadamente.

### Exportação e limites reais

`ExportButton.tsx` oferece PPTX e chama `scanAllSlides` seguido de `exportPresentationToPptx`. O scanner mede o DOM; o conversor usa PptxGenJS, escreve texto com `addText`, tabelas com `addTable` e formas nativas nos casos cobertos. Imagens e snapshots de gráficos entram como imagens. O conversor também usa ajuste de texto `fit: "shrink"` e captura certas falhas de elementos com `console.warn`; isso não é uma garantia de texto legível ou exportação sem omissões.

O README classifica o PPTX como parcial e reconhece diferenças de imagens/componentes. Marca exportação PDF como não iniciada; o seletor de exportação lido só possui PPTX. Isso sustenta **PPTX existente com limites** e **ausência de PDF nesse fluxo**, não uma conclusão de que todo o código foi testado ou que todos os tipos do editor são exportáveis/editáveis no PowerPoint.

`package.json` inclui, entre muitas dependências, `ag-charts-enterprise`. Não foi realizada auditoria de uso/licença de cada dependência. A conclusão prática é não supor que a licença MIT da raiz autoriza reutilizar indiscriminadamente tudo que o monorepo importa. O Zetta já tem ECharts; não há motivo para trazer mais motores nesta etapa.

### Fontes primárias fixadas

- [README e roadmap](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/README.md)
- [MIT](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/LICENSE)
- [Dependências](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/package.json)
- [Documento persistido](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/prisma/schema.prisma)
- [Documento PlateSlide](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/src/components/notebook/presentation/utils/parser.ts)
- [Prévias e aplicação de layout](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/src/components/presentation/floating-toolbar/LayoutPreviewSheet.tsx)
- [Catálogo de estruturas](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/src/lib/presentation/layout-catalog.ts)
- [Geração de roteiro](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/src/app/api/presentation/outline/route.ts)
- [Modelos/endpoints/download](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/src/lib/model-picker.ts)
- [Botão de exportação](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/src/components/presentation/buttons/ExportButton.tsx)
- [Scanner DOM](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/src/components/presentation/export/domSlideScanner.ts)
- [Conversor PPTX](https://github.com/allweonedev/presentation-ai/blob/43fe74abd5676dbbea52b8cd66c43fb3b931b5c1/src/components/presentation/export/domToPptxConverter.ts)

## 3. `data-formulator`: o que aproveitar sem instalar a plataforma

### Dados e procedência

`ComponentType.tsx` distingue origem de tabela, snapshot, arquivo/URL/conector, tabela de trabalho e resultado derivado. Uma derivação registra tabelas de origem, código, variável de saída e explicação. `DictTable.virtual.rowCount` distingue a quantidade total das linhas presentes no frontend, que podem ser amostra. O código também usa uma identidade estrutural do gráfico para detectar que um título ou variante ficou desatualizado depois de mudar os campos representados.

Esses conceitos ajudam diretamente a Zetta: origem precisa permanecer separada da versão editada; alterações cosméticas não devem fingir mudança factual; contagem total e seleção visível precisam ser explícitas. A Zetta não precisa incorporar execução de Python nem amostragem de grandes bancos para aplicar esses princípios a 12 categorias e três séries.

`dataOperations/models.ts` define estados como rascunho, seleção pendente, execução, parcialmente carregado, falha e cancelamento, com planos/resultados explícitos. Para ações locais de composição, basta o subconjunto pequeno **prévia → aplicar → desfazer**, com motivo de indisponibilidade em vez de fabricar uma transformação.

### Processamento e modelos

`pyproject.toml` confirma Flask, pandas, DuckDB, NumPy, LiteLLM, bibliotecas científicas e conectores. O cliente chama `litellm.completion`, com provedores remotos ou Ollama em endpoint configurável. `local_sandbox.py` executa código em subprocesso persistente no host Python. Executar localmente continua consumindo a máquina do usuário; colocar somente o frontend em hospedagem não altera isso.

Não é correto descrever a plataforma como dependência sem API obrigatória para a Zetta: embora seja possível configurar inferência local sem chave de provedor pago, há backend e processo/modelo a operar. Uma adoção completa seria expansão de arquitetura, fora das primeiras melhorias de composição.

### Gráficos e relatórios

`ChartRenderService.tsx` compila visualizações, produz SVG/PNG e mantém cache de representações estáticas. É um padrão relevante de consistência entre prévia e saída, mas introduzir Flint/Vega/Vega-Lite ao lado do ECharts atual não é necessário.

`ReportView.tsx` possui editor de relatório e exportação por impressão de um iframe HTML (`win.print()`), com imagens embutidas dos gráficos; PNG usa html2canvas. Existe função de PDF no código, porém é um relatório impresso, não um exportador de slides 16:9 já compatível com o documento da Zetta. Fidelidade e texto pesquisável dessa saída não foram executados/verificados aqui.

### Fontes primárias fixadas

- [README](https://github.com/microsoft/data-formulator/blob/5477f0e236426dc8f74a498ec400414fba7fbc0f/README.md)
- [MIT](https://github.com/microsoft/data-formulator/blob/5477f0e236426dc8f74a498ec400414fba7fbc0f/LICENSE)
- [Runtime/dependências Python](https://github.com/microsoft/data-formulator/blob/5477f0e236426dc8f74a498ec400414fba7fbc0f/pyproject.toml)
- [Dependências do frontend](https://github.com/microsoft/data-formulator/blob/5477f0e236426dc8f74a498ec400414fba7fbc0f/package.json)
- [Tipos, origem e derivação](https://github.com/microsoft/data-formulator/blob/5477f0e236426dc8f74a498ec400414fba7fbc0f/src/components/ComponentType.tsx)
- [Planos e estados de operação](https://github.com/microsoft/data-formulator/blob/5477f0e236426dc8f74a498ec400414fba7fbc0f/src/dataOperations/models.ts)
- [Cliente de modelos](https://github.com/microsoft/data-formulator/blob/5477f0e236426dc8f74a498ec400414fba7fbc0f/py-src/data_formulator/agents/client_utils.py)
- [Execução em subprocesso](https://github.com/microsoft/data-formulator/blob/5477f0e236426dc8f74a498ec400414fba7fbc0f/py-src/data_formulator/sandbox/local_sandbox.py)
- [Serviço local de renderização de gráficos](https://github.com/microsoft/data-formulator/blob/5477f0e236426dc8f74a498ec400414fba7fbc0f/src/views/ChartRenderService.tsx)
- [Relatório/PNG/impressão PDF](https://github.com/microsoft/data-formulator/blob/5477f0e236426dc8f74a498ec400414fba7fbc0f/src/views/ReportView.tsx)

## 4. Contratos propostos para a etapa 2 — composição

Implementação futura em `src/lib/composition.ts`, sem dependência nova. API pura, sem mutar o slide/deck recebido. O root mantém validação e aplicação no Editor.

```ts
type CompositionAction =
  | { type: 'split' }
  | { type: 'layout'; layout: Layout }
  | { type: 'focus-chart'; blockId: string }
  | { type: 'compare' }
  | { type: 'emphasize'; blockId: string }

type CompositionResult =
  | { ok: true; label: string; description: string; slides: Slide[] }
  | { ok: false; reason: string }

planComposition(
  slide: Slide,
  action: CompositionAction,
  context: { slideCount: number; makeId: () => string }
): CompositionResult
```

Detalhes de integração a fixar junto do renderer:

- `CompositionPanel` recebe `slide`, `theme`, `accent`, `slideCount` e `onApply(slides: Slide[])`. Renderiza propostas com `SlideCanvas`, mostra avisos reais e mantém opções indisponíveis com motivo. Não salva por conta própria.
- O Editor monta o deck candidato, valida limites de slides/imagens/documento e aplica os substitutos em uma única chamada de `change`. Desfazer recupera o slide original.
- Dividir distribui blocos na mesma ordem. Quando há um único texto muito longo, corta em limite de parágrafo/frase/palavra preservando os caracteres e sua ordem; nunca substitui texto por reticências na transformação. Notas e origem acompanham os resultados. Dados de gráfico permanecem completos, sem dividir séries/categorias automaticamente.
- Ampliar gráfico pode colocá-lo sozinho e levar os demais blocos para a continuação. A prévia torna essa reorganização explícita; sem espaço no limite de 50 slides, a ação fica indisponível.
- Comparação só se oferece quando houver dois grupos/blocos compatíveis. Não inventa o segundo lado de uma comparação.
- Destaque altera apresentação de um bloco existente; não cria afirmação nem número. A alteração visual não altera o baseline factual.
- Alternativas reutilizam layouts existentes e a mesma lista de blocos. Novos objetos recebem IDs novos; objetos movidos mantêm conteúdo, dados, imagem original e referências.

Critérios de teste: concatenação exata do texto dividido; igualdade profunda de dados/unidades de gráficos; notas/origem preservadas; IDs únicos; bloqueio no limite; aplicação reversível; nenhum renderer paralelo. Caso duas partes ainda não caibam, informar que são necessárias divisões adicionais, sem afirmar que o problema foi resolvido.

## 5. Contratos para a etapa 4 — briefing, lacunas e origem

Alinhamento recebido do root, ainda sem edição do app nesta triagem:

```ts
interface PresentationBrief {
  purpose: 'general' | 'proposal' | 'report' | 'lesson' | 'institutional'
  audience: 'general' | 'decision-makers' | 'technical' | 'students'
  durationMinutes?: number // 1..180; orientação aproximada
}

interface ContentOrigin {
  kind: 'source' | 'manual' | 'editorial' | 'reused'
  sourceName: string
  sourceKind: 'text' | 'pdf' | 'example' | 'manual'
  excerpt: string
  pages: number[]
  baseline?: string
}
// GenerationOptions.brief?; Deck.settings.brief?
// Slide.origin?; OutlineItem.origin?
// Slide.requirements?; OutlineItem.requirements? (perguntas, não fatos)
```

O root editará tipos e validação. Campos opcionais permitem abrir documentos anteriores; ausência de origem registrada será mostrada como tal, sem inventar um vínculo retroativo. Na reutilização em outro deck, `sourcePages=[]` evita validar referências contra outro PDF, enquanto `origin.pages` e `origin.sourceName` preservam a fonte externa do slide.

### Organização por regras com efeitos reais

Objetivo altera a ordem e o agrupamento de trechos existentes. Proposta prioriza contexto/problema, solução/escopo e próximos passos; relatório prioriza período/contexto, resultados/evidências e encaminhamentos; aula prioriza conceitos, exemplos e revisão; institucional prioriza identidade, atuação e contato/próximos passos. Termos e títulos existentes orientam a classificação, mantendo um grupo para material não classificado. Cada trecho entra uma vez: nada é descartado para caber em uma taxonomia.

Público também muda a prioridade: decisores recebem síntese/resultados antes de detalhes; público técnico recebe método/escopo/evidência; estudantes recebem conceitos antes de exemplos. Isso é uma ordenação explícita por regras, não uma promessa de compreensão semântica ou reescrita de todo o documento.

Duração orienta a quantidade/densidade sugerida, com regra declarada e possibilidade de revisão. O sistema não promete que o usuário falará por exatamente esse tempo. A UI deve avisar quando a reorganização substituiria um roteiro que já recebeu edição manual, oferecendo uma prévia ou uma ação explícita de reorganizar, sem sobrescrever esse trabalho ao trocar um seletor.

Quando nenhuma passagem sustentar um papel esperado, apresentar uma pergunta em `requirements`, por exemplo: “Qual próximo passo deve encerrar esta proposta?”. Não preencher com preço, prazo, meta, resultado ou promessa inventada. Lacunas são instruções de revisão e permanecem separadas do conteúdo factual.

### Conferência da origem

`createContentBaseline(slide)` pode ficar em `creation.ts`, módulo leve compartilhado. A projeção canônica deve incluir títulos, textos e dados/unidades/fontes/séries de gráfico ou dados de diagrama; deve excluir layout, estilos, animação, tipo meramente visual de gráfico e dados binários de imagem. Comparar a projeção atual com o baseline mostra edição real sem marcar troca de tema como mudança de informação. Não é assinatura criptográfica nem prova de veracidade.

`SourcePanel` recebe o slide e o deck, exibe o trecho preservado, nome da origem, páginas disponíveis, dados associados e indicação de alteração. PDF original não está armazenado hoje: a interface deve apresentar texto e referência de página, sem um link fictício que promete abrir o arquivo. Procedência permite conferir de onde veio a informação; não a verifica automaticamente.

Notas de risco: baseline e trecho precisam de limites validados; não duplicar imagens no baseline; não deixar composição visual criar falso estado de edição; ao dividir conteúdo, recalcular o baseline dos filhos somente se a origem anterior não estiver já editada, para não apagar a marca de revisão factual. O painel deve distinguir ausência de registro em um deck antigo de uma fonte editada.

## 6. Limites da inspeção e próximo passo

Não executei os projetos externos, não medi seu desempenho, não testei seus modelos, não comparei saída PPTX/PDF visualmente e não auditei todas as dependências. Nenhum código foi copiado desses repositórios. O valor confirmado nesta etapa está nos caminhos concretos de dados/layout/origem e em evitar a adoção de arquiteturas que acrescentariam processamento pesado ou serviços desnecessários.

Aguardando o anúncio do diagnóstico e dos tipos compartilhados pelo root antes de implementar composição, briefing e painéis.
