# Zetta v3 — triagem e contratos de marca, reutilização e recorte

Data da inspeção: **22/10/2026**. Trabalho nesta fase: leitura do prompt enviado pelo usuário, inspeção do projeto e consulta de código/documentação primária. **Nenhum arquivo do aplicativo foi alterado e nenhuma dependência foi instalada nesta triagem.**

## 1. Base efetivamente inspecionada

- Repositório: [maxeaseoficial-prog/Zetta](https://github.com/maxeaseoficial-prog/Zetta).
- Branch: `main`.
- Commit: `4f444c289d9eeb584be66c9949ef264739b7686c`.
- `git status --short` estava vazio no início da etapa.
- Escopo: evolução em etapas solicitada pelo usuário em 22/10/2026.
- Arquivos diretamente inspecionados para esta frente: `src/types.ts`, `src/lib/storage.ts`, `src/lib/validation.ts`, `src/lib/themes.ts`, `src/lib/files.ts` e os caminhos de tipografia, imagem e rodapé em `src/components/SlideCanvas.tsx`.

Confirmado no código: IndexedDB usa `zetta-local` versão 1, com store `decks`. Há uma fila de escrita, validação antes do salvamento e tratamento de quota/conexão. Não existem ainda stores de perfis ou slides reutilizáveis nessa base. O contrato de imagem contém `src`, `alt`, `illustration`, `fit`, `position` e `seed`; o renderer usa um único `position` percentual nos dois eixos e não tem zoom persistido.

O importador atual aceita imagens de até 12 MB para processamento, limita resolução, reduz o lado maior para até 2.000 pixels e gera WebP localmente. Logo, a imagem-base já guardada no documento pode ser uma versão normalizada do arquivo enviado. O novo recorte deve preservar **esse src incorporado**, sem recodificá-lo a cada ajuste. Não descrever isso como preservação byte a byte de um arquivo de câmera que já foi normalizado na importação.

Limites persistidos confirmados: 5 MiB por imagem incorporada, 20 MiB no conjunto de imagens do documento, 32 MiB no backup JSON, 50 slides, 6 blocos por slide, 500 mil caracteres no texto de uma fonte e 100 páginas. Os campos novos precisam entrar nesses controles; a marca não pode criar uma via alternativa para carregar URLs externas ou SVG importado.

## 2. Matriz de decisão

| Candidato e referência examinada                                                      | Necessidade e evidência                                                                                                              | Licença                                                            | Processamento/dependências                                                                                                                                      | Edição, persistência e PDF                                                                                                                                                                                | Decisão                                                                                                                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ValentinH/react-easy-crop` 6.2.4, `91bfd8f0928ead345e5126a539edab4657d82993`         | UI de arrastar, zoom, rotação e coordenadas de recorte; `src/Cropper.tsx`, `src/helpers.ts`, README e exemplo de saída               | MIT, copyright Valentin Hervieu                                    | Navegador, React/React DOM como peers `>=16.4.0`, `normalize-wheel ^1.0.1` em runtime. Nenhum backend ou modelo obrigatório encontrado no caminho examinado     | Entrega coordenadas; o app precisa persistir o enquadramento e renderizá-lo. O exemplo de saída usa Canvas e produz uma nova imagem, operação que não é necessária para o recorte não destrutivo do Zetta | **Usar como referência; não instalar nesta etapa.** Sliders de zoom e X/Y com preview SVG compartilhado cumprem o escopo com menos integração |
| `vizzuhq/vizzu-lib`, release 0.18.0 / HEAD `d81a7e9abf32830093c7b37101dc89898c700f7c` | Narrativas com transições entre configurações de dados; caminhos `vizzu.ts`, `chart.ts`, `plugins/htmlcanvas.ts`, `module/loader.ts` | Apache 2.0                                                         | API JS e engine C++/WASM no navegador. Pacote inclui `cvizzu.wasm`; manifesto declara `type-fest`. Não exige API remota para renderizar                         | Estado dos dados precisa permanecer no documento; Canvas padrão dificulta reaproveitar o pipeline vetorial. Nenhum exportador nativo de MP4 foi verificado nesta inspeção                                 | **Adiar.** ECharts já resolve a etapa de gráficos; não adicionar um segundo motor                                                             |
| `bklit/bklit-ui`, HEAD `d3a00cce3184a8d1c80899970a8bae292b3c2666`                     | Acabamento e animação de componentes; `packages/ui/src/charts`, documentação e registry                                              | UI/registry: MIT. `packages/studio`: licença proprietária separada | Componentes cliente React, Motion, Visx/D3, medição de DOM e estilos. `packages/ui` tem peer React 18 ou 19; manifesto usa React 19.2. Pacote interno é privado | SVG depende de dimensões/estilos e estado final; não foi encontrada uma API geral de exportação estática nos caminhos revisados. Persistência/editor seriam responsabilidade do Zetta                     | **Referência visual, sem nova engine. Não copiar Studio** sob a licença dos componentes                                                       |

Os SHAs de Vizzu e Bklit foram consultados novamente no GitHub e permanecem exatamente iguais aos da pesquisa anterior. A comparação completa de gráficos está no [relatório anterior](../chart-references.md).

## 3. react-easy-crop: evidência mais detalhada

### Referências primárias fixadas

- Commit: https://github.com/ValentinH/react-easy-crop/commit/91bfd8f0928ead345e5126a539edab4657d82993
- README: https://github.com/ValentinH/react-easy-crop/blob/91bfd8f0928ead345e5126a539edab4657d82993/README.md
- Licença: https://github.com/ValentinH/react-easy-crop/blob/91bfd8f0928ead345e5126a539edab4657d82993/LICENSE
- Manifesto: https://github.com/ValentinH/react-easy-crop/blob/91bfd8f0928ead345e5126a539edab4657d82993/package.json
- Componente: https://github.com/ValentinH/react-easy-crop/blob/91bfd8f0928ead345e5126a539edab4657d82993/src/Cropper.tsx
- Geometria/restauração: https://github.com/ValentinH/react-easy-crop/blob/91bfd8f0928ead345e5126a539edab4657d82993/src/helpers.ts
- Exemplo que gera outra imagem: https://github.com/ValentinH/react-easy-crop/blob/91bfd8f0928ead345e5126a539edab4657d82993/docs/src/components/cropImage.ts

**Confirmado no código:** o componente mostra um `<img>` ou `<video>` e aplica transformações CSS de translação, rotação e escala. Usa eventos de mouse, toque, roda e teclado, `ResizeObserver` e `requestAnimationFrame`. O callback de recorte retorna área percentual e área em pixels. O exemplo de saída cria Canvas, desenha a imagem e gera um Blob; essa geração é código adicional do exemplo, não uma obrigação para usar o componente.

**Descrito no README e coerente com os helpers:** restaurar `initialCroppedAreaPercentages` é preferível a restaurar coordenadas arredondadas em pixels, pois evita pequenas derivações repetidas. O componente precisa de um container com posicionamento definido e a documentação alerta para medição incorreta em modais cuja animação inicial altera a escala/tamanho. CSS é injetado automaticamente por padrão, mas existe opção de importação explícita.

**Compatibilidade não executada:** o intervalo de peer dependencies aceita React 19; a análise não executou o pacote no Zetta. O manifesto de desenvolvimento ainda referencia React 18. Isso sustenta uma compatibilidade declarada, não prova uma jornada de React 19 testada aqui.

**Por que não adotar agora:** o requisito inicial é zoom e reposicionamento de imagens dentro do frame do slide, sem rotação, filtros, vídeo ou exportação de arquivos recortados. Um componente curto com controles nativos e a geometria SVG já usada no produto evita uma segunda interpretação de crop. Se depois forem necessários arrastar/pinça/rotação avançados, o candidato continua válido; seria carregado apenas ao abrir o editor de imagem e exigiria adaptação explícita ao estado persistido.

Não foi medido o bundle final de react-easy-crop. Não há alegação de desempenho testado no Mac do usuário. A alternativa proposta acrescenta zero dependência de runtime.

## 4. Reconfirmação de Vizzu e Bklit

### Vizzu

- Commit: https://github.com/vizzuhq/vizzu-lib/commit/d81a7e9abf32830093c7b37101dc89898c700f7c
- Licença reconfirmada: https://github.com/vizzuhq/vizzu-lib/blob/d81a7e9abf32830093c7b37101dc89898c700f7c/LICENSE
- Manifesto reconfirmado: https://github.com/vizzuhq/vizzu-lib/blob/d81a7e9abf32830093c7b37101dc89898c700f7c/package.json
- API: https://github.com/vizzuhq/vizzu-lib/blob/d81a7e9abf32830093c7b37101dc89898c700f7c/src/apps/weblib/ts-api/vizzu.ts
- Canvas: https://github.com/vizzuhq/vizzu-lib/blob/d81a7e9abf32830093c7b37101dc89898c700f7c/src/apps/weblib/ts-api/plugins/htmlcanvas.ts
- Loader WASM: https://github.com/vizzuhq/vizzu-lib/blob/d81a7e9abf32830093c7b37101dc89898c700f7c/src/apps/weblib/ts-api/module/loader.ts

O commit é de 20/04/2026. O manifesto enumera o arquivo WASM no pacote e a API observada anteriormente monta o renderer Canvas. Nenhuma mudança de referência altera a decisão anterior. Os tamanhos medidos antes para o artefato 0.18.0 foram 61.404 bytes de JS minificado e 399.475 bytes de WASM, sem representar gzip ou custo do bundle final; não houve nova instalação nesta etapa.

### Bklit

- Commit: https://github.com/bklit/bklit-ui/commit/d3a00cce3184a8d1c80899970a8bae292b3c2666
- Componentes MIT: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/LICENSE
- Studio proprietário: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/LICENSE-STUDIO.md
- Manifesto UI: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/packages/ui/package.json
- Gráfico de barras: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/packages/ui/src/charts/bar-chart.tsx
- Barra animada: https://github.com/bklit/bklit-ui/blob/d3a00cce3184a8d1c80899970a8bae292b3c2666/packages/ui/src/charts/bar.tsx

O commit é de 21/10/2026. Os dois arquivos de licença foram lidos novamente. A licença MIT dos componentes não libera o código de `packages/studio`; a licença específica exige permissão escrita para copiar/incorporar Studio em outros produtos, entre outras restrições. O novo escopo de marca/reutilização não precisa copiar esse editor.

## 5. Contratos aprovados para a etapa 3

Contratos combinados com o agente root durante a triagem. Root centraliza tipos e validação; este agente implementará helpers, persistência de biblioteca e painéis depois do anúncio consolidado do diagnóstico.

```ts
type BrandFontId = 'sans' | 'serif'

interface BrandKit {
  id: string
  name: string
  logo?: { src: string; alt: string }
  colors: { accent: string; background: string; foreground: string }
  font: BrandFontId
  footer: string // vazio significa sem texto de rodapé
}

interface SlideAppearance {
  themeId: ThemeId
  accent: string
  brand?: BrandKit
}

interface ImageCrop {
  x: number // 0..100, posição no excedente horizontal
  y: number // 0..100, posição no excedente vertical
  zoom: number // 1..4 sobre a escala de cover
}

interface ContentOrigin {
  kind: 'source' | 'manual' | 'editorial' | 'reused'
  sourceName: string
  sourceKind: 'text' | 'pdf' | 'example' | 'manual'
  excerpt: string
  pages: number[]
  baseline?: string
}

interface ReusableSlide {
  id: string
  name: string
  createdAt: string
  slide: Slide
}

// Campos opcionais aditivos:
// Deck.brand?: BrandKit
// Slide.appearance?: SlideAppearance
// Slide.origin?: ContentOrigin
// Slide.requirements?: string[]
// OutlineItem.origin?: ContentOrigin
// OutlineItem.requirements?: string[]
// SlideBlock.image.crop?: ImageCrop
```

### Marca e regras de aplicação

`Deck.brand` incorpora um snapshot completo. Excluir/editar um perfil local depois não altera documentos existentes. O `id` identifica o perfil de origem, mas o renderer nunca precisa consultar uma biblioteca para obter logo, cores ou fonte.

Resolver compartilhado:

```ts
resolveAppearance(
  slide: Slide,
  baseTheme: Theme,
  accent: string,
  brand?: BrandKit,
): { theme: Theme; accent: string; brand?: BrandKit }

applyBrandToDeck(
  deck: Deck,
  kit: BrandKit,
  mode: 'preserve' | 'reset-colors',
): Deck
```

Se `slide.appearance` existe, ele representa o visual completo preservado: `brand` ausente dentro desse snapshot significa **sem marca para esse slide**, não herança automática de `Deck.brand`. A marca efetiva define background, foreground, accent e fonte; muted/surface podem ser derivados pelo resolver. Sem marca, manter o comportamento legado.

Modo `preserve`: conservar `slide.appearance`, backgrounds e overrides de cor existentes. Modo `reset-colors`: limpar `slide.appearance`, `slide.background` e somente `color`/`background` de `titleStyle` e estilos dos blocos. Preservar tamanho, alinhamento, negrito, conteúdo, notas, números, fonte dos dados, crop e layout. O texto do controle precisa dizer quais personalizações serão removidas. A aplicação é explícita e entra em uma ação do histórico.

### Fontes

Contrato de fonte confirmado com o agente de renderer/PDF: IDs `sans` e `serif`, com fontes reais **Liberation Sans / Liberation Serif 2.1.5**, TTF regular/negrito, licença OFL 1.1, carregadas sob demanda. Esse agente é responsável por confirmar os arquivos/fontes no projeto e criar `src/lib/fonts.ts` com `fontFamilyFor` e `ensureBrandFonts`. A mesma fonte e métrica devem aparecer no SVG e ser incorporadas no PDF. Não tentar incorporar Arial/Georgia proprietárias como se acompanhassem o aplicativo; slides legados sem marca continuam no caminho anterior.

As evidências detalhadas das fontes pertencem à pesquisa do agente de renderer/PDF; não foram produzidas por uma execução deste agente.

### Reutilização e origem

O slide salvo carrega conteúdo editável, imagens incorporadas, dados de gráficos, estilos, enquadramento, `appearance` resolvida e `origin`. Ao inserir, regenerar IDs do slide e de todos os blocos para não colidir com o documento de destino. Preservar notas e requisitos. Inserir com modo `preserve` mantém o visual do item; modo `adapt` remove apenas o snapshot `appearance`, aplicando a aparência do documento de destino sem apagar os overrides individuais de cor.

Na inserção, `sourcePages=[]`: páginas da apresentação anterior não podem se tornar referências ao PDF do documento de destino. Os números das páginas originais continuam em `origin.pages`, ao lado do trecho e do nome da fonte. Não gerar links para um PDF que não está armazenado. Se o slide legado não tem origem estruturada, aproveitar fonte/texto/notas existentes e identificar esse material de forma fiel; não afirmar que um trecho foi verificado.

Limites definidos pelo root para a origem: excerpt até 500.000 caracteres, baseline até 100.000, páginas inteiras 1..100. Não truncar dados para caber: validar e explicar falhas antes de alterar o documento.

### Recorte não destrutivo

O contrato usa a escala cover já existente, multiplicada por zoom. Com imagem natural `nw × nh` e frame `w × h`:

```text
scale = max(w / nw, h / nh) * zoom
imageW = nw * scale
imageH = nh * scale
imageX = frame.x + (w - imageW) * (x / 100)
imageY = frame.y + (h - imageH) * (y / 100)
```

Usar clipPath do frame, sem gerar uma imagem recortada nova. Sem `crop`, usar `x=y=image.position` e `zoom=1`, preservando documentos antigos. `contain` ignora o crop guardado; aplicar um novo recorte muda explicitamente para `cover`. Controles em português: posição horizontal, posição vertical, zoom, redefinir, cancelar e aplicar. Preview é estado temporário; só Aplicar modifica o documento e cria uma ação no histórico.

Geometria compartilhada combinada com o agente de renderer:

```ts
resolveImagePlacement(
  image: NonNullable<SlideBlock['image']>,
  natural: { width: number; height: number },
  frame: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number }

getBlockFrame(
  slide: Slide,
  theme: Theme,
  blockId: string,
): { x: number; y: number; w: number; h: number } | null
```

Este agente será dono de `src/lib/imageCrop.ts`; renderer consome o helper e fornece `getBlockFrame` baseado no plano real. O caller resolve marca/appearance antes de pedir o frame. Não duplicar a fórmula no CropPanel e no SlideCanvas.

## 6. Persistência e limites da biblioteca

Evoluir o mesmo banco IndexedDB para versão 2, adicionando stores de perfis e slides reutilizáveis. Não recriar/apagar `decks`. Preservar fila de escrita, clone/validação antes de gravar e recuperação após erros de quota. Root fornecerá `validateBrandKit` e `validateSlide`; os componentes não devem inventar schemas divergentes.

Proposta operacional: até 20 perfis e 50 slides salvos, com orçamento total de 64 MiB para a biblioteca, medido nos dados serializados. Os limites do documento continuam iguais; inserção/aplicação valida o documento completo antes de confirmar. Os limites finais precisam aparecer na mensagem de erro e nunca causar remoção automática de material anterior.

Logo é apenas raster incorporado validado, sujeito aos limites por imagem e ao total de imagens do documento. Contar logos de `Deck.brand` e snapshots de aparência; não permitir que o mesmo recurso contorne o orçamento por estar num campo novo. Não incorporar HTML, CSS arbitrário, SVG externo, URLs de fonte ou URLs de imagem.

Preferir listagem de metadados e carregar o slide completo quando selecionado para preview/inserção; não montar 50 renderers e decodificar todas as imagens ao abrir a biblioteca. Nenhum modelo, GPU ou serviço remoto é inicializado por esses painéis.

## 7. Props de integração

```ts
type BrandPanelProps = {
  deck: Deck
  onApply: (kit: BrandKit, mode: 'preserve' | 'reset-colors') => void
  onClose: () => void
}

type SlideLibraryPanelProps = {
  deck: Deck
  slideId: string
  onInsert: (item: ReusableSlide, mode: 'preserve' | 'adapt') => void
  onClose: () => void
}

type CropPanelProps = {
  image: NonNullable<SlideBlock['image']>
  frame: { width: number; height: number }
  onApply: (crop: ImageCrop) => void
  onClose: () => void
}
```

O root integra os callbacks ao histórico do Editor. Remoção/troca de imagem não ocorre dentro de CropPanel. A biblioteca local é auxiliar; abrir e exportar uma apresentação continua independente da existência dos perfis ou itens salvos.

## 8. Verificações a executar na implementação

- Migração de um banco versão 1 preserva todos os decks e cria apenas os novos stores.
- Aplicar marca em dois documentos, apagar perfil e reabrir ambos com a mesma aparência.
- Confirmar modos preservar/remover cores e desfazer a aplicação.
- Salvar slide com imagem, gráfico, notas e origem; inserir em outro documento, regenerar IDs e manter fontes/páginas na origem correta.
- Backup/reimportação sem depender das bibliotecas locais.
- Crop sem mudar `image.src`, inclusive após salvar/reabrir, desfazer/refazer e trocar de layout.
- Mesma geometria de crop em preview, miniatura, apresentação e PDF.
- Logos e slides perto dos limites falham antes de alterar o documento existente.
- Teclado, foco, cancelamento de rascunhos e carregamento de imagem com erro.
- Medir somente o que for executado no ambiente disponível; não extrapolar para o Mac do usuário.

Até o fechamento desta triagem, essas são verificações planejadas, não resultados declarados como aprovados.
