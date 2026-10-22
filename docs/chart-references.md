# Zetta — comparação técnica de bibliotecas de gráficos

Pesquisa concluída em **22 de outubro de 2026**. Escopo: gráficos com dados editáveis, animação em apresentações, execução local sem API de inferência ou dados e exportação estática para PDF. Foram consultados repositórios públicos pelo conector GitHub, documentação primária e metadados públicos do npm. Não houve instalação nem execução de código de Vizzu ou Bklit para esta pesquisa.

## Recomendação

**Apache ECharts 6.1.0, com SVGRenderer e importações modulares**, atende melhor ao conjunto de requisitos do Zetta. Oferece gráficos de barras/colunas, linhas/área e pizza/rosca, animação real de entrada e atualização e uma API oficial de renderização SVG sem DOM. Essa última capacidade permite que o aplicativo derive gráficos estáticos com dimensões fixas para miniaturas e PDF usando o mesmo modelo de dados.

O Zetta deve continuar sendo dono dos dados e do editor. ECharts não é um editor de apresentações e não gera um arquivo PDF sozinho. O estado persistido deve conter categorias, valores, séries, unidades, fonte, tipo e opções controladas do gráfico. SVG e instâncias de ECharts são resultados derivados, não a fonte editável.

Uma instância interativa no navegador permite transições por `setOption`. Para o MVP que apresenta SVGs como imagens, o SVG SSR do ECharts também pode carregar animações CSS de entrada, dentro das limitações documentadas. Isso não equivale a um componente interativo com atualização animada. Em ambos os caminhos, o PDF deve usar um resultado separado com `animation: false`.

## Aplicação no Zetta nesta entrega

A recomendação foi implementada com **ECharts 6.1.0**. O app possui seis tipos (colunas, barras horizontais, linhas, área, pizza e rosca), dados editáveis, importação CSV/TSV ou tabela colada, até três séries e até 12 categorias em novos gráficos. Valores, unidades, nomes de séries e fonte ficam no documento e no backup. Documentos anteriores continuam aceitos.

O modo de apresentação usa **animação de entrada** no SVG, com repetição, controle de ativação e respeito à preferência de movimento reduzido. Não foram implementados tooltip interativo, bar-race nem transformação animada entre tipos. Editor, miniaturas e PDF usam o desenho final estático. Os seis tipos foram executados no Chromium e comparados por pixels: o quadro final da animação coincide com o snapshot estático em todos eles. Um PDF real de sete páginas foi gerado e conferido.

A biblioteca é importada por módulos. As instâncias são descartadas após gerar o SVG e o cache tem limite de itens e bytes. Nenhum dado é enviado para um serviço de gráficos. Vizzu e Bklit continuam referências, sem código incorporado nesta entrega. Consulte [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) para os avisos incluídos na distribuição.

As seções de pesquisa abaixo distinguem capacidades das bibliotecas do que foi efetivamente implementado no Zetta.

## Versões e commits examinados

| Repositório         | Referência                       | Commit completo                            | Data verificada                                                             |
| ------------------- | -------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| `vizzuhq/vizzu-lib` | `main`, também release `v0.18.0` | `d81a7e9abf32830093c7b37101dc89898c700f7c` | Commit: 20/04/2026 12:38:43 UTC; release: 20/04/2026 13:02:16 UTC           |
| `bklit/bklit-ui`    | `main`                           | `d3a00cce3184a8d1c80899970a8bae292b3c2666` | Commit: 21/10/2026 19:41:57 UTC                                             |
| `apache/echarts`    | `master` consultado na pesquisa  | `34f4d927eafe251f26f63afd3aeefa30f2feba30` | Commit: 04/10/2026 10:59:16 UTC                                             |
| `apache/echarts`    | release recomendada `6.1.0`      | `c5a48f5f97d23e5379720870b8444cd05b50ffb4` | Commit: 13/05/2026 04:01:41 UTC; release publicada: 19/05/2026 17:38:29 UTC |

Links das versões:

- Vizzu: https://github.com/vizzuhq/vizzu-lib/releases/tag/v0.18.0
- ECharts: https://github.com/apache/echarts/releases/tag/6.1.0
- Bklit: https://github.com/bklit/bklit-ui/tree/d3a00cce3184a8d1c80899970a8bae292b3c2666

As documentações online podem mudar depois desta pesquisa. Os links de código com SHA fixam o material examinado.

## Comparação

| Critério                 | ECharts                                                                           | Vizzu                                                                          | Bklit UI                                                                       |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Licença examinada        | Apache 2.0                                                                        | Apache 2.0                                                                     | Componentes UI/registry: MIT; Studio: licença proprietária separada            |
| Núcleo                   | JavaScript, zrender                                                               | C++ compilado para WASM, API JavaScript                                        | Componentes React, Motion, Visx/D3 e estilos                                   |
| Animação real            | Entrada, atualização e remoção por diff; universal transition em casos suportados | Transições entre configurações e perspectivas de dados são centrais ao produto | Entrada real com Motion; atualizações variam por componente                    |
| React 19                 | Integração imperativa por ref/effect; sem dependência de React no núcleo          | Integração imperativa cliente; sem dependência de React no núcleo              | Código examinado usa React 19.2; peer declara React 18 ou 19                   |
| Renderização usual       | Canvas ou SVG                                                                     | Canvas com engine WASM                                                         | SVG no DOM, com componentes React e CSS                                        |
| SVG sem DOM              | API oficial `ssr: true` + `renderToSVGString`                                     | Não encontrada no caminho HTML/API examinado                                   | Não encontrada uma API geral de exportação SVG SSR nos componentes examinados  |
| PDF estático             | Gerar SVG final separado e incorporá-lo pela infraestrutura do app                | Capturar Canvas final é o caminho natural da implementação examinada           | Requer resolver dimensões, estilos/fontes e estado final antes de capturar SVG |
| API externa em runtime   | Não é necessária                                                                  | Não é necessária; WASM pode ser hospedado localmente                           | Não é necessária para componentes copiados; registry é distribuição de código  |
| Melhor encaixe observado | Gráficos editáveis com renderer único e saída estática previsível                 | Narrativas de dados cuja principal diferenciação são transformações visuais    | Componentes de interface React com estética e animações prontas                |

“Compatível com React 19” para ECharts/Vizzu é uma conclusão arquitetural baseada em não dependerem de React e poderem ser montados via efeito. Não é uma alegação de certificação de um wrapper específico. Evitar adicionar um wrapper de terceiros sem necessidade.

## Apache ECharts

### Evidências relevantes

- README e licença: https://github.com/apache/echarts/tree/c5a48f5f97d23e5379720870b8444cd05b50ffb4
- Licença: https://github.com/apache/echarts/blob/c5a48f5f97d23e5379720870b8444cd05b50ffb4/LICENSE
- Manifesto: https://github.com/apache/echarts/blob/c5a48f5f97d23e5379720870b8444cd05b50ffb4/package.json
- Importações modulares: https://echarts.apache.org/handbook/en/basics/import/
- Renderização no servidor/SVG sem DOM: https://echarts.apache.org/handbook/en/how-to/cross-platform/server/
- Animações e atualização de dados: https://echarts.apache.org/handbook/en/how-to/animation/transition/
- APIs de renderização/exportação, código examinado: https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/src/core/echarts.ts
- Universal transition, código examinado: https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/src/animation/universalTransition.ts

O núcleo da versão 6.1.0 depende de zrender 6.1.0 e tslib. O manifesto examinado não inclui React nem engine WASM. A documentação exige registrar o renderer explicitamente ao usar a interface modular. É possível registrar somente gráficos, componentes e recursos usados pelo Zetta.

O caminho oficial de SVG SSR recebe tamanho explícito e não depende de elementos DOM. `ssr: true` desliga o loop normal de animação/eventos da instância. O SVG exportado pode incluir animação CSS inicial. A documentação registra limitações dessa animação SSR, incluindo efeitos especiais de linha, animação de rótulos e bar-race; não extrapolar a capacidade para todos os gráficos ou transições.

Para animação interativa, a biblioteca compara dados entre chamadas `setOption`. Identificadores estáveis de séries e dados evitam confundir atualização com remoção/adição. O código de universal transition examinado estabelece limite de 10 mil dados para caminhos de transformação; isso fica muito acima do limite editorial de categorias previsto para o Zetta, mas demonstra que universal transition não é irrestrita.

`getSvgDataURL` no código examinado para as animações dos elementos antes de serializar. Por isso, capturar o renderer vivo para exportar pode interferir na reprodução. Gerar uma instância separada para exportação evita esse acoplamento.

### Verificação executada

Foi usado o **ECharts 6.1.0 efetivamente instalado no projeto** para um teste direto em Node, sem DOM e sem chamadas de rede. Foram registrados Bar, Line, Pie, Grid, Legend e SVGRenderer. Gerados três gráficos de 640 × 360, com `ssr: true` e `animation: false`:

| Gráfico |  SVG gerado |
| ------- | ----------: |
| Colunas | 3.736 bytes |
| Linhas  | 4.472 bytes |
| Rosca   | 2.213 bytes |

Todos produziram SVG com elementos vetoriais; nenhum continha `@keyframes`, `foreignObject` ou `script` nesse teste. O contador de chamadas a `fetch` foi zero. Cada instância foi descartada com `dispose`. Esse teste confirma o caminho estático básico; não substitui a validação visual do PDF final com fontes, temas e rótulos longos.

### Tamanho publicado

Os tamanhos abaixo são dos arquivos pré-compilados minificados da release 6.1.0, consultados na árvore de distribuição. **Não são gzip, tamanho transferido nem tamanho de um build modular do Zetta**.

| Arquivo                      |     Bytes |
| ---------------------------- | --------: |
| `dist/echarts.min.js`        | 1.121.883 |
| `dist/echarts.common.min.js` |   715.020 |
| `dist/echarts.simple.min.js` |   500.315 |
| `dist/echarts.esm.min.js`    | 1.121.654 |

Fonte: https://github.com/apache/echarts/tree/c5a48f5f97d23e5379720870b8444cd05b50ffb4/dist

Medir o bundle real depois de escolher imports. Carregamento dinâmico é apropriado para não colocar o motor de gráficos no caminho inicial da tela de entrada.

## Vizzu

### Evidências relevantes

- README e árvore: https://github.com/vizzuhq/vizzu-lib/tree/d81a7e9abf32830093c7b37101dc89898c700f7c
- Licença: https://github.com/vizzuhq/vizzu-lib/blob/d81a7e9abf32830093c7b37101dc89898c700f7c/LICENSE
- Documentação: https://lib.vizzuhq.com/latest/
- FAQ: https://lib.vizzuhq.com/latest/FAQ/
- API e animações: https://github.com/vizzuhq/vizzu-lib/blob/d81a7e9abf32830093c7b37101dc89898c700f7c/src/apps/weblib/ts-api/vizzu.ts
- Montagem do chart: https://github.com/vizzuhq/vizzu-lib/blob/d81a7e9abf32830093c7b37101dc89898c700f7c/src/apps/weblib/ts-api/chart.ts
- Plugin Canvas: https://github.com/vizzuhq/vizzu-lib/blob/d81a7e9abf32830093c7b37101dc89898c700f7c/src/apps/weblib/ts-api/plugins/htmlcanvas.ts
- Loader WASM: https://github.com/vizzuhq/vizzu-lib/blob/d81a7e9abf32830093c7b37101dc89898c700f7c/src/apps/weblib/ts-api/module/loader.ts

Vizzu tem vantagem quando o produto quer mostrar transformações entre perspectivas de dados. A API de `animate` trabalha com alvos/configurações e encadeamento assíncrono. Esse é movimento real de representação dos dados.

O caminho padrão examinado cria `HTMLCanvasElement`, usa contexto Canvas 2D, `ResizeObserver` e resize do navegador. O loader permite fornecer `wasmUrl`, de modo que os arquivos da engine podem ser hospedados pelo próprio aplicativo. O carregamento e inicialização são assíncronos.

O método `store()` guarda configuração, estilo e filtro de dados; a documentação no código informa que ele não inclui os dados propriamente ditos nem opções de animação. Portanto, esse snapshot não pode substituir o modelo de dados persistido do Zetta.

Não foi encontrada uma API de SVG SSR no caminho HTML/API examinado. Isso é uma observação do escopo revisado, não uma prova de impossibilidade de implementação por plugin. Para a arquitetura padrão, a saída estática natural é capturar o Canvas após estabilizar o estado final. Esse trabalho adicional reduz a vantagem do Vizzu no requisito de um pipeline vetorial previsível para PDF.

### Tamanho verificado do artefato npm

Foi lido o manifesto público e o tarball da versão 0.18.0 em memória, sem instalar nem executar o pacote:

- Metadados: https://registry.npmjs.org/vizzu/0.18.0
- Tarball: https://registry.npmjs.org/vizzu/-/vizzu-0.18.0.tgz
- Integridade publicada: `sha512-uXoLfSsdoQMLy1aKZjqXxv235NLb/M9pE265/sGCLTaKMauOwPNG52hDPOAomUemTLylvurywowrgQtrxfTCVQ==`

| Artefato                                |   Bytes |
| --------------------------------------- | ------: |
| Tarball comprimido completo             | 232.765 |
| `dist/vizzu.min.js`, tamanho do arquivo |  61.404 |
| `dist/cvizzu.wasm`, tamanho do arquivo  | 399.475 |

O tamanho do tarball não é o custo de transferência do aplicativo. O custo final depende dos arquivos realmente servidos, compressão HTTP e cache. Não confundir o pequeno wrapper JavaScript com o total incluindo WASM.

## Bklit UI

### Separação de licenças

O repositório examinado contém **duas licenças**. Componentes de `packages/ui` e registry shadcn estão sob MIT. `packages/studio` e o produto Studio têm uma licença proprietária separada. A licença do Studio reserva direitos e exige permissão escrita para usos como copiar/incorporar o código do Studio, modificar/redistribuir ou revender derivados. Assim, não copiar o editor Studio para o Zetta com base na licença MIT dos componentes.

- README: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/README.md
- MIT dos componentes: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/LICENSE
- Studio: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/LICENSE-STUDIO.md

### Código e documentação

- Instalação: https://bklit.com/docs/installation
- Gráfico de barras: https://bklit.com/docs/components/bar-chart
- Gráfico de linhas: https://bklit.com/docs/components/line-chart
- Manifesto UI: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/packages/ui/package.json
- Barra: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/packages/ui/src/charts/bar.tsx
- Gráfico de barras: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/packages/ui/src/charts/bar-chart.tsx
- Medição do container: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/packages/ui/src/charts/chart-parent-size.tsx
- Contexto de preview estático: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/packages/ui/src/charts/static-chart-preview-context.tsx
- Progresso de montagem: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/packages/ui/src/charts/use-mount-progress.ts

O manifesto examinado usa React/React DOM 19.2.0 e peers React 18 ou 19. Depende de Motion 12.27 e módulos Visx 4.0, além de utilitários de UI/medição. Não foi encontrada engine WASM. O pacote interno `@bklitui/ui` está marcado privado; o caminho documentado de distribuição usa registry shadcn e copia componentes para o projeto. Não tratar como uma dependência única pronta para instalar e medir por um número universal de bundle.

As barras possuem animação real de entrada por Motion, incluindo crescimento e efeito de opacidade. Depois que `isLoaded` fica verdadeiro, o componente examinado retorna um `rect` estático com transição CSS de opacidade. O efeito que recomeça a entrada depende de duração, `revealSignature` e status; não depende diretamente dos dados. Portanto, não concluir que qualquer atualização numérica de barras terá morph de altura só porque a entrada é animada. A documentação de linhas descreve transições de domínio Y e caminhos; cada componente precisa ser avaliado individualmente.

O gráfico de barras depende de medição de container via `useParentSize`. Com dimensões menores que dez pixels, o componente interno retorna `null`. O SVG também usa estilos e variáveis CSS do contexto HTML. Um pipeline estático precisa fornecer dimensões, resolver estilos/fontes e garantir o estado final de animação. O contexto chamado “static preview” examinado desativa um mecanismo de reveal; ele não é uma API geral de exportação SVG pronta. Não extrapolar essa observação para todos os componentes: alguns possuem dimensões explícitas próprias.

## Padrões de implementação recomendados

1. **Persistir dados canônicos.** Manter categorias, valores por série, rótulos, unidade, fonte, tipo e flags de animação/valores. Não aceitar funções JavaScript importadas em backups. Formatação deve ser função interna do aplicativo.
2. **Converter dados em opções por uma função pura.** Um builder compartilhado deve produzir opções coerentes para editor, apresentação, miniaturas e exportação. Separar somente o que realmente muda entre modos, como animação, dimensão e interação.
3. **Usar dimensões determinísticas para exportação.** Criar renderer SSR temporário com tamanho fixo, `animation: false`, renderizar SVG e fazer `dispose`. Não capturar um gráfico a meio da animação.
4. **Usar animação de acordo com o renderer escolhido.** Instância viva + `setOption` dá atualizações animadas; SVG SSR como imagem atende animações CSS de entrada suportadas. Não prometer as mesmas interações em ambos.
5. **Controlar movimento no aplicativo.** Respeitar `prefers-reduced-motion` e um controle explícito de reprodução. Essa é responsabilidade de integração, não uma capacidade automática universal que esta pesquisa tenha confirmado.
6. **Cuidar do ciclo de vida React.** Na integração imperativa, criar no efeito, usar identificadores estáveis, atualizar por `setOption`, observar o tamanho e descartar a instância no cleanup; isso precisa funcionar com a montagem/limpeza de desenvolvimento do StrictMode.
7. **Carregar somente o necessário.** Importar núcleo, gráficos e componentes usados; registrar SVGRenderer; evitar importar a distribuição inteira sem medir. Carregar o módulo sob demanda quando apropriado.
8. **Preservar números.** Parsers e serializadores devem ter locale explícito, não arredondar valores persistidos e não inventar dados a partir do texto. Erros e limites devem ser visíveis ao usuário.
9. **Tratar PDF como saída estática.** O backup editável guarda o modelo; PDF mostra o estado final. Não prometer animação ou reedição estrutural do gráfico dentro de um PDF convencional.
10. **Validar o resultado do produto.** Verificar rótulos longos, séries múltiplas, negativos, zero, fontes, temas, dimensões reduzidas e arquivo PDF real. O teste SSR desta pesquisa valida capacidade técnica básica, não toda a qualidade de composição.

## Limites desta pesquisa

- O código de Bklit e Vizzu foi lido; suas engines não foram executadas nesta análise.
- Foi executado um teste estático real de ECharts 6.1.0 sem DOM e sem rede, não uma bateria visual completa.
- Não foi medido o bundle customizado final do Zetta nesta pesquisa.
- Ausência de uma API de exportação nos caminhos examinados não prova que uma extensão ou implementação adicional seja impossível.
- A recomendação é para os requisitos do Zetta. Vizzu continua uma opção relevante se transformações complexas de perspectivas de dados se tornarem a função central do produto.
