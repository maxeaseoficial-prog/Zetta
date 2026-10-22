# Zetta 0.3

**Suas ideias, em boa forma.**

Aplicativo web em português brasileiro para transformar texto e PDFs digitais em apresentações editáveis. O documento preserva conteúdo, dados, imagens, notas e origem; o editor permite revisar a composição, aplicar uma marca e reutilizar slides em outras apresentações.

Feito com React, TypeScript e Vite, com interface azul e processamento no navegador. O fluxo principal funciona sem conta, chave de API ou modelo de IA obrigatório.

## Usar pelo navegador

O Zetta pode ser publicado como **site estático na Vercel**. Depois de publicado, basta abrir a URL no navegador: não é necessário instalar Node.js, clonar o projeto ou baixar modelos no Mac para criar, editar, apresentar e exportar.

A hospedagem entrega o aplicativo, suas bibliotecas e fontes. A extração de PDF, a organização do roteiro, a edição, os gráficos e a exportação continuam usando CPU e memória do dispositivo. Os documentos não são enviados para um backend de processamento. A IA local é uma opção experimental, desligada por padrão, com download separado e explícito.

Para publicar, importe este repositório na Vercel com o preset **Vite**, comando **npm run build** e diretório de saída **dist**. O arquivo [vercel.json](vercel.json) declara essa configuração. Não há funções de servidor nem variáveis de ambiente obrigatórias. Também é possível servir `dist/` na raiz de um domínio usando outro serviço estático. HTTPS é necessário para recursos como WebGPU; localhost é aceito durante o desenvolvimento.

Detalhes sobre processamento, armazenamento e expansão remota estão em [Processamento e recuperação](docs/processing-and-recovery.md). Nenhum serviço remoto de IA, OCR ou vídeo foi ativado nesta versão.

## O que funciona na versão 0.3

- Entrada de texto e leitura de PDF digital, com referências às páginas de origem.
- Roteiro por regras com objetivo, público, duração desejada e prévia antes de substituir tópicos.
- Registro de origem por slide, perguntas editoriais para revisão e indicação de alterações de texto ou dados desde o registro.
- Editor 16:9 com seleção de elementos, edição de texto no slide, propriedades e notas.
- Seis temas, oito layouts, três densidades de texto e composição essencial ou visual.
- Assistente **Melhorar composição**, com prévias para dividir, ampliar um gráfico, comparar blocos, destacar texto ou trocar o layout.
- Blocos editáveis de **Processo**, **Linha do tempo**, **Comparação** e **Indicadores**.
- Kits de marca com nome, logo, paleta, Liberation Sans ou Serif e rodapé.
- Biblioteca local de slides com conteúdo, dados, imagens, estilos e origem incorporados.
- Imagens próprias, ilustrações geométricas e recorte não destrutivo com zoom e posição em dois eixos.
- Seis tipos de gráficos, até três séries, importação de tabelas e mapeamento explícito de colunas.
- Animação de entrada dos gráficos no player, repetição e respeito à preferência de movimento reduzido.
- Adicionar, duplicar, excluir e reorganizar slides; desfazer e refazer.
- Salvamento automático em IndexedDB e backup editável **.zetta.json**, com importação validada.
- Apresentação com teclado, navegação e tela cheia; PDF pesquisável ou PDF como imagem.
- Revisão opcional e experimental de trechos com IA local via WebLLM.

## Experimentar os novos recursos

### 1. Criar e conferir o roteiro

Cole um texto ou envie um PDF com texto selecionável. Na etapa **Para quem e para quê?**, escolha objetivo e público; a duração é opcional e orienta uma sugestão de quantidade de slides, sem estimar com precisão o tempo de fala.

Use **Ver roteiro sugerido** para comparar a proposta. **Aplicar este roteiro** substitui os tópicos e suas edições pela prévia; **Manter direção atual** conserva o roteiro em uso. Revise títulos, conteúdo e perguntas antes de escolher o visual e clicar em **Criar minha apresentação**.

O motor é determinístico: identifica trechos, prioriza tópicos e distribui blocos. Não pesquisa na internet nem completa fatos ausentes. Perguntas a resolver são sugestões editoriais identificadas como tal. Textos longos podem aparecer resumidos por seleção no slide; a fonte integral e o conteúdo de origem permanecem disponíveis para consulta.

No editor, abra **Fonte original** para consultar o trecho registrado, as páginas, notas e dados atuais. O indicador de edição compara texto, notas e dados com o registro inicial; mudanças de cor, layout ou recorte não contam como alteração de conteúdo. Esse registro ajuda na conferência e não certifica a veracidade das informações.

### 2. Melhorar a composição e editar diagramas

Clique em **Melhorar composição**, escolha uma operação disponível e confira a prévia antes de **Aplicar composição**. A mudança acompanha textos, dados e notas e pode ser desfeita. Se ainda houver conteúdo demais, o painel mostra avisos para continuar ajustando antes de exportar.

Em **Adicionar**, escolha **Processo**, **Linha do tempo**, **Comparação** ou **Indicadores**. Edite título, itens, descrições, rótulos, valores e fonte no painel de propriedades. A ordem dos itens é manual. Datas e indicadores são conteúdo informado pelo usuário; o aplicativo não calcula valores nem infere resultados.

Cada diagrama armazena até seis itens. Comparações funcionam melhor com dois e indicadores com até quatro; o conteúdo excedente continua no documento, com orientação para reorganizar. Os diagramas permanecem editáveis no Zetta e vetoriais no PDF pesquisável.

### 3. Aplicar uma marca

Abra **Design → Kit de marca**. Defina nome, logo, cores, tipografia e rodapé e confira a prévia.

- **Salvar perfil** guarda o kit na biblioteca deste navegador para uso posterior.
- **Aplicar marca** incorpora a marca à apresentação. Escolha entre preservar cores individuais e o visual de slides reutilizados ou reaplicar a marca removendo essas personalizações de cor e aparência.
- A reaplicação mantém texto, dados, notas, tamanho/alinhamento dos elementos e recortes. A alteração do documento pode ser desfeita.

Os perfis usam **Liberation Sans** ou **Liberation Serif 2.1.5**, regular/negrito, licenciadas sob OFL 1.1. Os arquivos acompanham o site e somente a família necessária é carregada. O backup guarda a escolha de fonte; os TTF são recursos do aplicativo e não são copiados para cada JSON. Os mesmos arquivos de fonte são usados na renderização e na incorporação do PDF.

Editar ou excluir um perfil salvo não altera automaticamente apresentações que já receberam sua cópia. Para mudar um documento existente, aplique a marca explicitamente nele.

### 4. Recortar e posicionar uma imagem

Selecione um bloco de imagem e use **Enviar minha imagem**. Depois abra **Recortar e posicionar** para ajustar zoom, posição horizontal e vertical. A prévia não altera o documento até **Aplicar recorte**.

O recorte guarda apenas o enquadramento: a imagem incorporada continua inteira para novos ajustes. A importação inicial normaliza o arquivo e sua resolução no navegador. Aplicar um recorte usa **Preencher área**; **Imagem inteira** mostra o recurso completo e ignora o recorte guardado enquanto esse modo estiver ativo.

As imagens automáticas continuam sendo cinco estilos de ilustrações geométricas geradas em SVG por código. Fotografias são enviadas pelo usuário; não há geração de fotografias por um modelo de imagem.

### 5. Guardar e reutilizar um slide

Abra **Biblioteca de slides** abaixo da lista de miniaturas. Dê um nome ao slide atual e clique em **Salvar na biblioteca**. Em outra apresentação, abra a mesma biblioteca, selecione o item e confira sua prévia e origem.

Ao inserir, escolha entre preservar a aparência salva ou usar o tema e a marca da apresentação de destino. Cores definidas em elementos individuais são mantidas. A cópia entra depois do slide atual, recebe novos identificadores e continua independente e editável.

O item leva conteúdo, dados, imagens, recortes, estilos, notas e registro de origem. Páginas do documento anterior permanecem identificadas como origem externa; não viram referências ao PDF do novo documento. O PDF original não é armazenado. Excluir o item da biblioteca não remove as cópias já inseridas em apresentações.

### 6. Conferir gráficos e mapear uma tabela

1. Na tela inicial, clique em **Experimentar gráficos** para abrir a apresentação de demonstração com capa e seis tipos de gráfico. Os dados são identificados como fictícios.
2. Selecione um gráfico. Cole uma tabela ou use **Importar CSV**; há um [CSV de exemplo](public/examples/dados-ficticios.csv).
3. Confira o formato numérico **Brasil** ou **Internacional** e abra **Prévia e colunas**.
4. Escolha explicitamente **A primeira linha é cabeçalho** ou **A primeira linha contém dados**. Nenhuma opção começa selecionada; o conteúdo original permanece visível até essa decisão.
5. Escolha a coluna das categorias e até três colunas de valores. Confira a tabela original, os valores interpretados e a indicação das colunas que ficarão de fora pela sua seleção.
6. Clique em **Aplicar dados mapeados** para atualizar o gráfico. Na edição direta da tabela, use **Aplicar dados**. Abra **Conferir dados aplicados** para inspecionar os valores atuais.
7. Ajuste tipo, unidade, fonte, exibição de valores e animação. Em **Apresentar**, use **Repetir animação** ou **Animar gráficos**; a preferência de movimento reduzido do sistema é respeitada.

Exemplo de tabela com três séries:

```csv
Mês;Receita;Despesa;Lucro
Janeiro;12000;8500;3500
Fevereiro;14500;9200;5300
Março;16000;10000;6000
```

O Zetta aceita CSV com campos entre aspas, TSV, tabelas Markdown e duas colunas simples. O mapeamento permite selecionar colunas em outra ordem e informa quais não serão usadas. Todas as linhas de dados precisam caber no limite e ter estrutura válida; nenhuma é descartada para fazer a tabela caber. Células ausentes ou números inválidos geram erro, sem preenchimento automático.

O formato numérico escolhido determina como pontos e vírgulas são interpretados. Zero e negativos são preservados. Números sem representação fiel no modelo numérico do aplicativo são rejeitados. Pizza e rosca exigem uma única série, sem valores negativos e com total positivo; os outros quatro tipos aceitam negativos.

O rascunho da tabela é mantido ao trocar de slide ou painel na mesma sessão, e sair do editor exige revisar ou descartar dados pendentes. Salvamento, apresentação, PDF e backup usam os dados já aplicados. Rascunhos ainda não aplicados não sobrevivem ao fechamento do navegador.

A animação é de entrada, sem transformação animada entre tipos, tooltip interativo ou movimento dentro do PDF. ECharts executa localmente e é carregado sob demanda quando um gráfico precisa ser renderizado. A criação automática também pode reconhecer tabelas estruturadas com cabeçalho e até três séries no material de entrada; os dados continuam sujeitos à conferência.

### 7. Apresentar, exportar e guardar um backup

Use **Apresentar** para navegar pelos slides com teclado ou controles e entrar em tela cheia. As notas ficam no editor; um console separado de apresentador ainda não foi implementado.

Em **Baixar PDF**, escolha o modo descrito abaixo. Use **Baixar backup editável** para guardar o documento e continuar a edição em outra instalação do Zetta. O PDF é uma entrega estática; o arquivo `.zetta.json` é o formato de recuperação do documento editável.

## PDF e fidelidade visual

Editor, miniaturas, player e exportação compartilham o componente `SlideCanvas`. Os dois modos produzem uma página **960 × 540 pt** por slide, na proporção 16:9, sem seleção ou ferramentas do editor.

| Modo                         | Conteúdo do arquivo                                                                          | Fontes e imagens                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Exportar PDF pesquisável** | Textos selecionáveis/pesquisáveis; gráficos e diagramas em vetores, no estado final estático | Fontes Liberation incorporadas. Fotos e logos permanecem imagens. Apenas as ilustrações geométricas decorativas são rasterizadas para preservar seu acabamento |
| **Exportar PDF como imagem** | Uma imagem de **2560 × 1440** por página; texto sem pesquisa ou seleção                      | Preserva a aparência renderizada pelo navegador, incluindo as fontes disponíveis no momento da exportação                                                      |

A rasterização das ilustrações decorativas no modo pesquisável é uma adaptação delimitada às incompatibilidades de transparência, gradientes e traçados do conversor `svg2pdf.js`. Ela é informada no relatório da exportação e não transforma o texto, os gráficos ou os diagramas do slide em imagem. O documento Zetta continua guardando as ilustrações como configurações editáveis.

Em apresentações legadas, o PDF pesquisável substitui explicitamente Arial por Liberation Sans e Georgia por Liberation Serif. Isso pode alterar pequenas medidas tipográficas; a configuração original permanece no documento. Kits de marca usam as mesmas fontes locais no editor e no PDF.

Antes de exportar, o Zetta verifica espaço para textos, rótulos, valores e diagramas. Conteúdo fora do limite interrompe a exportação com indicação do slide a ajustar. Falhas de carregamento ou caracteres sem glifo na fonte incorporada também podem impedir o modo pesquisável. Corrija o recurso ou escolha explicitamente o modo imagem. O aplicativo não troca silenciosamente para uma página raster nem baixa um PDF parcial após falha.

## Onde os dados ficam e como recuperar

Apresentações e bibliotecas ficam no IndexedDB **zetta-local**, neste perfil de navegador e nesta origem do site — protocolo, domínio e porta. Uma URL de preview e um domínio de produção usam armazenamentos separados. Não há conta, sincronização entre dispositivos ou armazenamento de documentos em servidor.

Limpar os dados do site, usar navegação privada, perder o dispositivo ou sofrer remoção de armazenamento pelo navegador pode eliminar o trabalho local. Guarde backups fora do navegador. Ao importar um `.zetta.json`, o Zetta cria outra apresentação, sem sobrescrever um documento existente.

O backup contém fonte textual, slides, notas, dados, configurações, imagens e marcas incorporadas. Ele não exporta toda a biblioteca nem os arquivos de fonte do aplicativo. Em outro navegador, importe os documentos e salve novamente os perfis ou slides que desejar reutilizar. URLs de imagens externas e SVG arbitrário não são aceitos pela validação.

Na 0.3, o formato do documento permanece **`schemaVersion: 1`**, com campos novos opcionais. O banco IndexedDB passa de **versão 1 para 2**, acrescentando stores de marcas e slides reutilizáveis sem recriar a store de apresentações. Backups antigos continuam aceitos. Voltar ao aplicativo 0.2 na mesma origem pode falhar porque ele pede um banco de versão 1; ele também desconhece os campos novos. Consulte o procedimento e os limites em [Processamento e recuperação](docs/processing-and-recovery.md) antes de testar um downgrade.

Desfazer/refazer guarda o histórico da sessão. Não há versões nomeadas persistentes. Salvar um perfil ou item da biblioteca é uma operação de armazenamento separada da aplicação da marca ou inserção do slide no documento.

## Limites atuais

Os valores de armazenamento abaixo usam MiB. A quota real do navegador pode ser menor; falhas são informadas sem remover automaticamente documentos ou itens anteriores.

| Recurso                                       | Limite / comportamento                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| PDF de entrada                                | 20 MiB, até 100 páginas e 500 mil caracteres extraídos                           |
| PDF escaneado                                 | Sem OCR; é necessário texto selecionável                                         |
| Texto colado                                  | Até 150 mil caracteres pela interface                                            |
| Criação automática                            | Até 20 slides, incluindo capa e encerramento                                     |
| Documento editado                             | Até 50 slides e 6 blocos por slide                                               |
| Imagem/logo enviado                           | JPG, PNG ou WebP, até 12 MiB; normalização local para até 2.000 px no maior lado |
| Imagem/logo incorporado                       | Até 5 MiB por recurso e 20 MiB no documento, incluindo snapshots de marca        |
| Recorte                                       | Zoom de 1× a 4×; posição horizontal e vertical de 0 a 100%                       |
| Diagrama                                      | Até 6 itens; recomendações visuais de 2 para comparação e 4 para indicadores     |
| Novos gráficos                                | Até 12 categorias e 3 séries; limites visuais podem exigir divisão               |
| Prévia para mapear colunas                    | De 2 a 16 colunas; escolha explícita de categorias e até 3 séries                |
| Arquivo de dados do gráfico                   | CSV/TSV/TXT até 1 MiB e 100 mil caracteres                                       |
| Biblioteca local                              | Até 20 marcas e 50 slides, compartilhando 64 MiB de dados serializados           |
| Backup                                        | Até 32 MiB                                                                       |
| Revisão por IA local                          | Entrada de até 1.800 caracteres; saída sujeita ao limite do campo selecionado    |
| Contas, colaboração, PPTX, OCR e fotos por IA | Não implementados                                                                |

Inserir um slide ou aplicar uma marca valida novamente o documento inteiro. Caber na biblioteca não garante caber na apresentação de destino. Recursos incorporados repetidos, inclusive logos, entram no orçamento de suas cópias.

## IA local experimental

Selecione um texto e abra **Revisar com IA local** para encurtar, clarear ou transformar o trecho em tópicos.

- O modelo só é baixado depois do clique explícito em **Baixar e ativar IA local**.
- WebLLM executa a inferência em um Web Worker, usando a GPU do dispositivo.
- Modelo configurado: `Qwen2.5-0.5B-Instruct-q4f32_1-MLC`.
- Os arquivos externos do modelo exigem internet e envolvem centenas de MB.
- O conteúdo selecionado não é enviado para uma API externa de inferência.
- A sugestão aparece em uma prévia; aplicar é uma ação explícita e reversível.
- Cancelar ou fechar encerra o worker e preserva o texto original.

A compatibilidade e o desempenho dependem do navegador, WebGPU, memória e hardware. A interface detecta incompatibilidade. O fluxo padrão de criação, edição, marca, biblioteca e PDF funciona sem ativar IA.

A inferência real e a qualidade da reescrita ainda precisam de validação em hardware com GPU compatível. Os testes automatizados desta implementação não baixaram pesos de modelo. As verificações de capacidade, carregamento sob demanda, cancelamento e limites estão documentadas nos registros de validação; não equivalem a uma avaliação factual ou editorial dos resultados do modelo.

## Desenvolvimento local

Esta seção é para trabalhar no código. Para utilizar uma publicação do Zetta, basta abrir o site.

Recomendado: Node.js 24 e npm. Clone o repositório e execute:

```bash
npm ci
npm run dev
```

Abra a URL exibida pelo Vite. Não é necessário arquivo `.env`, banco de dados de servidor ou chave de API.

| Comando             | Finalidade                                      |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Desenvolvimento local                           |
| `npm run typecheck` | Verificação de TypeScript                       |
| `npm test`          | Testes unitários e de domínio                   |
| `npm run build`     | Build de produção em `dist/`                    |
| `npm run preview`   | Conferir o build localmente                     |
| `npm run test:e2e`  | Jornadas de navegador com Playwright e Vite dev |

### Executar os testes de navegador

Prepare o navegador com **`npx playwright install chromium`**. O Playwright inicia Vite dev automaticamente na porta 4173 quando `ZETTA_TEST_URL` não está definida. Mantenha essa porta livre de um servidor de preview. Em ambientes com Chromium já instalado, `ZETTA_BROWSER_PATH` pode indicar o executável.

O teste **`brand-library-storage.spec.ts` exige Vite dev**: ele importa `/src/lib/storage.ts` e `/src/lib/brand.ts` dentro do navegador para exercitar transações, limites e recuperação de falhas. Não rode esse arquivo contra `dist/`, `vite preview` ou uma publicação de produção.

Para usar um servidor dev explícito, inicie em um terminal:

```bash
npm run dev -- --host 127.0.0.1 --port 5284
```

Em outro terminal:

```bash
ZETTA_TEST_URL=http://127.0.0.1:5284 npx playwright test tests/e2e/brand-library-storage.spec.ts
```

Para conferir as jornadas de interface contra o build, execute `npm run build`, inicie `npm run preview -- --host 127.0.0.1 --port 4174` e, em outro terminal, selecione os arquivos compatíveis:

```bash
ZETTA_TEST_URL=http://127.0.0.1:4174 npx playwright test tests/e2e/workspace.spec.ts tests/e2e/charts.spec.ts tests/e2e/evolution.spec.ts
```

As evidências obtidas contra Vite dev e contra o build são registradas separadamente.

## Organização do código

- `src/types.ts`: contrato do documento, marca, origem, diagramas e slides reutilizáveis.
- `src/lib/generator.ts` e `creation.ts`: roteiro por regras, briefing, origem e comparação de conteúdo.
- `src/lib/composition.ts`: propostas puras de reorganização de slides.
- `src/lib/chartData.ts`: parsing, formato numérico e mapeamento de tabelas.
- `src/lib/chartLayout.ts`: helpers puros de layout, avisos e formatação de gráficos.
- `src/lib/chartRenderer.ts` e `chartRuntime.ts`: renderer ECharts, cache e carregamento sob demanda.
- `src/lib/diagramLayout.ts`: geometria e avisos compartilhados dos diagramas.
- `src/lib/brand.ts`: resolução de aparência, aplicação de marca e cópias de slides.
- `src/lib/imageCrop.ts`: geometria compartilhada de enquadramento não destrutivo.
- `src/lib/fonts.ts` e `public/fonts/`: fontes locais e carregamento por família.
- `src/lib/pdfImport.ts`: extração local com PDF.js.
- `src/lib/validation.ts`: validação de documentos, backups, marcas e slides.
- `src/lib/storage.ts`: IndexedDB v2, fila de gravação e limites das bibliotecas.
- `src/lib/themes.ts`: temas e paletas.
- `src/components/SlideCanvas.tsx`: renderização comum de slides.
- `src/lib/exportPdf.ts`: PDF pesquisável e modo imagem a partir do mesmo renderer.
- `src/hooks/useDeckHistory.ts`: histórico de edição da sessão.
- `src/lib/localAi.ts` e `localAi.worker.ts`: sessão opcional de inferência local.
- `src/components/`: entrada, roteiro, editor, player e painéis em português.
- `tests/`: testes de domínio, fixtures legadas e jornadas de navegador.

## Verificação e decisões de evolução

O [registro de validação 0.3](docs/validation-0.3.md) reúne os cenários executados, ambientes, evidências visuais, resultados e limitações desta versão. Os testes incluem compatibilidade de backups e migração, origem e números literais, aplicação de marca, reuso, recorte, dados mapeados, diagramas, composição, PDF e recuperação de falhas do armazenamento. A evidência de desempenho não deve ser extrapolada para o Mac do usuário sem medição nele.

Como histórico, a validação da **0.2.0** registrou **104 testes de lógica e sete jornadas no navegador**. O [registro anterior](docs/validation-2026-10-22.md) permanece disponível. Esses números não representam a bateria final da 0.3.

A avaliação da qualidade narrativa e da IA local exige revisão humana com materiais reais. Testes de fluxo e registros de origem não garantem precisão factual do conteúdo informado.

Documentação desta evolução:

- [Auditoria da base e plano de evolução](docs/evolution-audit.md).
- [Matriz de referências, commits, licenças e decisões](docs/evolution-references.md).
- [Processamento, recuperação e propostas futuras](docs/processing-and-recovery.md).
- [Validação da versão 0.3](docs/validation-0.3.md).

A triagem desta etapa examinou 14 projetos/referências por documentação e caminhos de código. ECharts permanece como engine de gráficos; **svg2pdf.js 2.8.1** é a dependência de runtime acrescentada para o PDF pesquisável. Diagramas e controles de recorte usam estruturas próprias do Zetta. Liberation 2.1.5 acompanha o projeto como recurso estático licenciado.

Mermaid, react-easy-crop, Vizzu e Bklit não foram instalados nesta etapa. As plataformas completas de apresentações, transformação de dados e vídeo foram referências, sem seus backends ou modelos incorporados ao fluxo atual. A matriz distingue leitura de código, hipóteses e integrações efetivamente testadas.

Análises anteriores e atribuições:

- [Referências de apresentações](docs/presentation-references.md).
- [Referências de gráficos](docs/chart-references.md).
- [Avisos de terceiros](THIRD_PARTY_NOTICES.md).

## Referências técnicas

- [React](https://react.dev/).
- [Vite](https://vite.dev/guide/).
- [PDF.js](https://mozilla.github.io/pdf.js/examples/).
- [jsPDF](https://github.com/parallax/jsPDF).
- [svg2pdf.js](https://github.com/yWorks/svg2pdf.js).
- [Liberation Fonts](https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5).
- [ECharts: SVG sem DOM e animações de entrada](https://echarts.apache.org/handbook/en/how-to/cross-platform/server/).
- [ECharts: importações modulares](https://echarts.apache.org/handbook/en/basics/import/).
- [WebLLM: uso básico](https://webllm.mlc.ai/docs/user/basic_usage.html).
- [WebLLM: Web Workers](https://webllm.mlc.ai/docs/user/advanced_usage.html).
- [Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct).

Os layouts e as ilustrações são implementações próprias. Não há dependência da API ou do código do Gamma.
