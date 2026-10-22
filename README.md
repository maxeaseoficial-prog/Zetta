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

Gráficos usam os números informados no material ou no editor. O parser trata vírgula decimal, zero, números negativos e diferentes separadores. Dados ambíguos ou que sofreriam arredondamento silencioso são rejeitados. Gráficos extensos demais para um slide precisam ser divididos.

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

## Onde os dados ficam

As apresentações são salvas no banco IndexedDB **zetta-local** deste navegador. Não há conta, sincronização entre dispositivos ou armazenamento em servidor.

Limpar os dados do site, usar navegação privada ou perder o dispositivo pode eliminar o trabalho local. Use **Baixar backup editável** para guardar uma cópia independente. Ao importar, o Zetta cria uma nova apresentação, sem sobrescrever um documento existente.

O backup contém o texto original, slides, notas, configurações e imagens incorporadas. A importação valida formato, limites, identificadores e imagens. URLs de imagens externas e SVG arbitrário não são aceitos.

## PDF e fidelidade visual

Editor, miniaturas, player e exportação compartilham o componente SlideCanvas.

A exportação rasteriza cada slide a **2560 × 1440** e gera um PDF de páginas **960 × 540 pt**, preservando a proporção 16:9. Isso produz uma entrega estática consistente; os textos do PDF são parte da imagem de cada página, não campos editáveis ou pesquisáveis. A edição continua disponível no Zetta e no backup.

Antes de exportar, o Zetta verifica espaço para textos, rótulos e valores de gráficos. Se houver conteúdo fora do limite, a exportação é interrompida com indicação do slide que precisa de ajuste. A seleção e as ferramentas do editor nunca entram no arquivo.

## Limites iniciais

| Recurso                         | Limite / comportamento                                            |
| ------------------------------- | ----------------------------------------------------------------- |
| PDF de entrada                  | 20 MB, até 100 páginas e 500 mil caracteres extraídos             |
| PDF escaneado                   | Sem OCR nesta versão; é necessário texto selecionável             |
| Texto colado                    | Até 150 mil caracteres pela interface                             |
| Criação automática              | Até 20 slides, incluindo capa e encerramento                      |
| Documento editado               | Até 50 slides, com no máximo 6 blocos por slide                   |
| Imagem enviada                  | JPG, PNG ou WebP; redimensionada no navegador                     |
| Imagem incorporada              | Até 5 MB por imagem e 20 MB no documento                          |
| Backup                          | Até 32 MB                                                         |
| Revisão por IA local            | Entrada de até 1.800 caracteres; saída sujeita ao limite do campo |
| Colaboração / contas            | Não implementadas                                                 |
| PowerPoint / OCR / fotos por IA | Não implementados                                                 |

## Organização do código

- src/types.ts: contrato versionado do documento.
- src/lib/generator.ts: roteiro e composição por regras.
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

A avaliação de qualidade narrativa e da IA local exige revisão humana com materiais reais. Os testes de fluxo não representam uma garantia de precisão factual dos documentos.

## Referências técnicas

- [React](https://react.dev/)
- [Vite](https://vite.dev/guide/)
- [PDF.js](https://mozilla.github.io/pdf.js/examples/)
- [jsPDF](https://github.com/parallax/jsPDF)
- [WebLLM: uso básico](https://webllm.mlc.ai/docs/user/basic_usage.html)
- [WebLLM: Web Workers](https://webllm.mlc.ai/docs/user/advanced_usage.html)
- [Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)

Os layouts e as ilustrações são implementações próprias. Não há dependência da API ou do código do Gamma.
