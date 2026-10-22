# Zetta

**Suas ideias, em boa forma.**

Aplicativo web para transformar conteúdo existente em apresentações editáveis. Feito com React, TypeScript e Vite, com identidade azul e processamento no navegador.

## O que já funciona

- Entrada de texto e leitura de PDF digital, com referências às páginas de origem.
- Revisão do roteiro antes de criar os slides.
- Seis modelos, cor de destaque personalizada, composição essencial ou visual e três densidades de texto.
- Editor 16:9 com seleção de elementos, edição de texto no slide, painel de propriedades, imagens próprias, ilustrações geométricas, destaques e gráficos.
- Oito layouts; adicionar, duplicar, excluir e reorganizar slides; desfazer e refazer.
- Salvamento automático no IndexedDB e reabertura no mesmo navegador.
- Backup editável em **.zetta.json**, com importação validada.
- Modo de apresentação com teclado, navegação e tela cheia.
- Download real de PDF, com uma página por slide.
- Seis tipos de gráficos: colunas, barras horizontais, linhas, área, pizza e rosca.
- Importação de dados CSV/TSV ou tabela colada, até três séries, valores e fonte editáveis.
- Animação de entrada dos gráficos ao apresentar, com repetição e movimento reduzido.
- Laboratório de gráficos com sete slides de exemplo, identificados como dados fictícios.
- Revisão **opcional e experimental** de trechos com IA local via WebLLM.

## Rodar localmente

Recomendado: Node.js 24 e npm.

1. Clone este repositório.
2. Execute **npm ci**.
3. Execute **npm run dev**.
4. Abra a URL exibida pelo Vite.

Não é necessário criar arquivo .env, configurar banco de dados ou fornecer chave de API.

| Comando           | Finalidade                          |
| ----------------- | ----------------------------------- |
| npm run dev       | Desenvolvimento local               |
| npm run typecheck | Verificação de TypeScript           |
| npm test          | Testes unitários e de domínio       |
| npm run build     | Build de produção em dist/          |
| npm run preview   | Conferir o build localmente         |
| npm run test:e2e  | Jornada no navegador com Playwright |

Para preparar o navegador dos testes, execute **npx playwright install chromium**. O Playwright inicia o servidor de desenvolvimento automaticamente. Em ambientes com um navegador já instalado, use ZETTA_BROWSER_PATH para indicar o executável; ZETTA_TEST_URL permite testar um servidor existente.

## Publicar

O projeto produz um site estático, sem funções de servidor.

Na Vercel, importe este repositório e use o preset **Vite**, comando **npm run build** e diretório de saída **dist**. O arquivo vercel.json já declara essa configuração. Nenhuma variável de ambiente é exigida.

Também é possível servir dist/ na raiz de um domínio usando outro serviço estático. HTTPS é necessário para recursos como WebGPU; localhost é aceito durante o desenvolvimento.

## Como a geração funciona

### Fluxo padrão, sem APIs externas

O motor inicial é determinístico. Ele identifica trechos, organiza um roteiro, seleciona conteúdo e distribui os blocos nos layouts. Ele **não pesquisa na internet nem inventa informações** para preencher slides.

Quando o conteúdo é longo, o texto visível é uma seleção; o material integral é preservado na fonte e nas notas. A interface informa isso e permite rever os tópicos antes da criação. Quantidades de slides podem ser ajustadas para evitar repetição artificial de conteúdo.

As imagens automáticas são **ilustrações geométricas criadas em SVG por código**, com cinco estilos e variações. Fotografias podem ser enviadas pelo usuário. Esta versão não oferece geração de fotografias por modelos de imagem.

Gráficos usam os números informados no material ou no editor. Tabelas com cabeçalho e até três séries podem virar gráficos na criação automática. O parser preserva zero e números negativos, valida todas as células e informa erros sem preencher valores ausentes ou descartar linhas. Gráficos extensos demais para um slide precisam ser divididos; a fonte integral permanece no documento.

O editor oferece formato numérico **Brasil** ou **Internacional** para importação. O formato escolhido define como pontos e vírgulas são interpretados. Números que não podem ser representados fielmente pelo modelo numérico do aplicativo são rejeitados. Unidade e fonte podem ser editadas separadamente.

### IA local experimental

No editor, selecione um texto e abra **Revisar com IA local**. O painel permite encurtar, clarear ou transformar o trecho em tópicos.

- O modelo só é baixado depois do clique explícito em **Baixar e ativar IA local**.
- WebLLM executa a inferência em um Web Worker, usando a GPU do dispositivo.
- Modelo configurado: Qwen2.5-0.5B-Instruct-q4f32_1-MLC.
- O download dos arquivos do modelo exige internet e envolve centenas de MB.
- Não há envio do conteúdo para uma API externa de inferência.
- O resultado aparece em uma prévia. A aplicação ao texto é explícita e pode ser desfeita.
- Cancelar ou fechar encerra o worker e preserva o texto original.

A compatibilidade e o desempenho dependem do navegador, WebGPU, memória e hardware. A interface detecta incompatibilidade. O fluxo padrão de criação, edição e PDF continua disponível sem IA.

**Validação da IA:** detecção de capacidade, carregamento sob demanda, cancelamento, limites, prévia e aplicação foram testados. A inferência real e a qualidade da reescrita ainda precisam de validação em hardware com GPU compatível. Nenhum peso foi baixado para os testes automatizados desta implementação.

## Experimentar os gráficos

1. Na tela inicial, clique em **Experimentar gráficos**. O laboratório abre uma apresentação com capa e um slide para cada tipo de gráfico. Todos os dados são fictícios.
2. Abra um slide e clique no gráfico para editar. Troque o tipo, cole uma tabela ou use **Importar CSV**. Há um [CSV de exemplo](public/examples/dados-ficticios.csv) no repositório.
3. Confira o formato dos números e clique em **Aplicar dados**. Abra **Conferir dados aplicados** para inspecionar os valores. Também é possível editar unidade, fonte, exibição dos valores e animação.
4. Clique em **Apresentar**. Use **Repetir animação** para recomeçar ou **Animar gráficos** para desativar o movimento. A preferência de movimento reduzido do sistema é respeitada.
5. Baixe o **PDF** para obter o resultado estático ou o **backup editável** para preservar os dados e continuar a edição depois.

Exemplo de tabela com três séries:

```csv
Mês;Receita;Despesa;Lucro
Janeiro;12000;8500;3500
Fevereiro;14500;9200;5300
Março;16000;10000;6000
```

O Zetta aceita CSV com campos entre aspas, TSV, tabelas Markdown e duas colunas simples. Para até três séries, inclua os nomes no cabeçalho e comece a primeira coluna com um nome reconhecível, como Categoria, Mês, Produto ou Região. Cabeçalhos ambíguos produzem orientação para ajuste; nomes numéricos de séries podem usar Markdown com uma linha separadora. Pizza e rosca exigem uma única série, sem valores negativos e com total positivo; os outros quatro tipos representam valores negativos.

Dados digitados ou importados só entram no gráfico ao clicar em **Aplicar dados**. O rascunho é preservado ao trocar de slide ou painel na mesma sessão de edição, e sair do editor exige revisar ou descartar dados pendentes. Salvamento, apresentação, PDF e backup usam os dados já aplicados. Rascunhos ainda não aplicados não sobrevivem ao fechamento do navegador.

A animação implementada é de entrada; não há transformação animada entre tipos, tooltip interativo ou animação dentro do PDF. O renderer ECharts é executado localmente e não exige chave, conta nem serviço externo de gráficos.

## Onde os dados ficam

As apresentações são salvas no banco IndexedDB **zetta-local** deste navegador. Não há conta, sincronização entre dispositivos ou armazenamento em servidor.

Limpar os dados do site, usar navegação privada ou perder o dispositivo pode eliminar o trabalho local. Use **Baixar backup editável** para guardar uma cópia independente. Ao importar, o Zetta cria uma nova apresentação, sem sobrescrever um documento existente.

O backup contém o texto original, slides, notas, configurações e imagens incorporadas. A importação valida formato, limites, identificadores e imagens. URLs de imagens externas e SVG arbitrário não são aceitos.

## PDF e fidelidade visual

Editor, miniaturas, player e exportação compartilham o componente SlideCanvas.

A exportação rasteriza cada slide a **2560 × 1440** e gera um PDF de páginas **960 × 540 pt**, preservando a proporção 16:9. Isso produz uma entrega estática consistente; os textos do PDF são parte da imagem de cada página, não campos editáveis ou pesquisáveis. A edição continua disponível no Zetta e no backup.

Antes de exportar, o Zetta verifica espaço para textos, rótulos e valores de gráficos. Se houver conteúdo fora do limite, a exportação é interrompida com indicação do slide que precisa de ajuste. A seleção e as ferramentas do editor nunca entram no arquivo.

## Limites iniciais

| Recurso                         | Limite / comportamento                                             |
| ------------------------------- | ------------------------------------------------------------------ |
| PDF de entrada                  | 20 MB, até 100 páginas e 500 mil caracteres extraídos              |
| PDF escaneado                   | Sem OCR nesta versão; é necessário texto selecionável              |
| Texto colado                    | Até 150 mil caracteres pela interface                              |
| Criação automática              | Até 20 slides, incluindo capa e encerramento                       |
| Documento editado               | Até 50 slides, com no máximo 6 blocos por slide                    |
| Imagem enviada                  | JPG, PNG ou WebP; redimensionada no navegador                      |
| Imagem incorporada              | Até 5 MB por imagem e 20 MB no documento                           |
| Novos gráficos                  | Até 12 categorias e 3 séries; limites visuais podem exigir divisão |
| Arquivo de dados do gráfico     | CSV/TSV/TXT até 1 MB e 100 mil caracteres                          |
| Backup                          | Até 32 MB                                                          |
| Revisão por IA local            | Entrada de até 1.800 caracteres; saída sujeita ao limite do campo  |
| Colaboração / contas            | Não implementadas                                                  |
| PowerPoint / OCR / fotos por IA | Não implementados                                                  |

## Organização do código

- src/types.ts: contrato versionado do documento.
- src/lib/generator.ts: roteiro e composição por regras.
- src/lib/chartData.ts: leitura e serialização rigorosa de tabelas numéricas.
- src/lib/chartRenderer.ts: opções, validação visual, SVG estático/animado e cache ECharts.
- src/lib/chartDemo.ts: laboratório com dados fictícios.
- src/components/ChartEditor.tsx: tipos, importação e propriedades dos gráficos.
- src/lib/pdfImport.ts: leitura local de PDF com PDF.js.
- src/lib/validation.ts: validação do documento e dos backups.
- src/lib/storage.ts: persistência local e fila de gravação.
- src/lib/themes.ts: modelos e paletas.
- src/components/SlideCanvas.tsx: renderização comum de slides.
- src/lib/exportPdf.ts: exportação usando o mesmo renderer.
- src/hooks/useDeckHistory.ts: histórico de edição.
- src/lib/localAi.ts e localAi.worker.ts: sessão opcional de inferência local.
- src/components/: entrada, roteiro, editor, apresentação e diálogos.
- tests/: verificações de geração, números, validação, armazenamento, IA e jornada completa.

## Verificação

Os testes cobrem preservação da fonte, rascunhos, gráficos, backups, limites, recuperação de falhas de escrita e cancelamento da IA. Os testes no navegador percorrem texto → roteiro → edição → desfazer/refazer → salvar/reabrir → apresentação → PDF, além de PDF digital, PDF sem texto, importação de backup e viewport móvel.

Os testes adicionais de gráficos cobrem parsing com formatos numéricos explícitos, múltiplas séries, precisão, validação de dados, compatibilidade de backups, geração nos seis temas, SVG estático/animado e o fluxo completo de CSV → edição → apresentação → PDF → backup.

Na validação da versão 0.2.0, passaram **104 testes de lógica e sete jornadas no navegador**. O [registro de validação](docs/validation-2026-10-22.md) descreve os cenários, a verificação visual e os limites da bateria.

A avaliação de qualidade narrativa e da IA local exige revisão humana com materiais reais. Os testes de fluxo não representam uma garantia de precisão factual dos documentos.

## Referências avaliadas para esta evolução

A pesquisa incluiu os seis repositórios sugeridos. O Zetta preserva seu documento editável e adotou ECharts como dependência; os demais projetos foram referências de arquitetura e interação.

| Projeto        | Decisão para o Zetta                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| Presenton      | Referência para elementos e templates estruturados. Seu backend e exportador separado não foram incorporados.   |
| SlideDeck AI   | Referência para um futuro adaptador de PPTX com objetos nativos. Não foi adicionado Python/Streamlit.           |
| Banana Slides  | Referência para revisão por página. Preservamos textos e gráficos como dados, sem migrar para slides em imagem. |
| Vizzu          | Opção futura para narrativas com transformações entre gráficos. Não foi adicionado um segundo renderer.         |
| Bklit UI       | Referência visual. Componentes UI e Studio possuem licenças distintas; nenhum código foi copiado.               |
| Apache ECharts | Integrado, versão 6.1.0, com importações modulares e SVG compartilhado entre os modos.                          |

Análises completas, arquivos examinados, commits e fontes:

- [Referências de apresentações](docs/presentation-references.md)
- [Referências de gráficos](docs/chart-references.md)
- [Avisos de terceiros](THIRD_PARTY_NOTICES.md)

## Referências técnicas

- [React](https://react.dev/)
- [Vite](https://vite.dev/guide/)
- [PDF.js](https://mozilla.github.io/pdf.js/examples/)
- [jsPDF](https://github.com/parallax/jsPDF)
- [ECharts: SVG sem DOM e animações de entrada](https://echarts.apache.org/handbook/en/how-to/cross-platform/server/)
- [ECharts: importações modulares](https://echarts.apache.org/handbook/en/basics/import/)
- [WebLLM: uso básico](https://webllm.mlc.ai/docs/user/basic_usage.html)
- [WebLLM: Web Workers](https://webllm.mlc.ai/docs/user/advanced_usage.html)
- [Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)

Os layouts e as ilustrações são implementações próprias. Não há dependência da API ou do código do Gamma.
