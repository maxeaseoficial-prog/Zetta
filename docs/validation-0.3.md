# Validação e entrega — Zetta 0.3

Registro de **22/10/2026**. Base: `4f444c289d9eeb584be66c9949ef264739b7686c` (0.2.0), inicialmente limpa. Branch de trabalho: `feat/composition-brand-vector-pdf`. A implementação preserva React, TypeScript, Vite, o contrato de slides e o renderer SVG compartilhado. O escopo não inclui merge em `main`, publicação de produção ou ativação de serviços externos.

## Resultado por etapa

| Etapa                   | Resultado verificável                                                                                                                                                                                         | Estado                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1. Compatibilidade      | Fixture exportada da 0.2 abre sem alterar seu conteúdo; edição, salvamento, backup e reimportação preservam os dados. Migração aditiva do IndexedDB v1 para v2.                                               | Concluída                                |
| 2. Composição           | Prévia de layouts, divisão sem apagar caracteres, destaque, comparação e espaço para gráficos. Aplicação atômica com desfazer/refazer; ações incompatíveis explicam o motivo.                                 | Concluída                                |
| 3. Marca e reutilização | Marca local com logo, cores, fontes e rodapé; biblioteca de slides; escolha explícita sobre aparência; recorte X/Y/zoom sem alterar a imagem incorporada.                                                     | Concluída                                |
| 4. Roteiro e origem     | Objetivo, público e duração orientam prioridades por regras; prévia protege o roteiro manual. Perguntas indicam informação ausente. Trechos, páginas, dados e indicação de edição ajudam a conferir a origem. | Concluída                                |
| 5. Gráficos             | Mantidos os seis tipos e até três séries da 0.2. Nova prévia exige interpretação explícita do cabeçalho e permite selecionar colunas. ECharts entra sob demanda.                                              | Concluída                                |
| 6. Diagramas            | Processo, linha do tempo, comparação e indicadores com campos estruturados, edição, ordenação, limites e avisos; SVG compartilhado com player/PDF.                                                            | Concluída                                |
| 7. PDF                  | Texto pesquisável, fontes incorporadas, gráficos e diagramas vetoriais; fallback delimitado das ilustrações decorativas. Modo imagem continua como escolha explícita.                                         | Concluída, com limites documentados      |
| 8. Console e versões    | Console separado com notas/próximo slide/cronômetro e versões nomeadas precisam de fluxos e retenção próprios.                                                                                                | Adiada, conforme prioridade da auditoria |

IA semântica de documentos inteiros, OCR, PPTX, vídeos, contas e sincronização continuam como [propostas separadas](processing-and-recovery.md), sem infraestrutura contratada ou dados enviados para destinos novos. O fluxo padrão permanece utilizável sem API externa ou download de modelos.

## Ambiente e comandos executados

Linux do ambiente de desenvolvimento; Node.js **24.19.0**; Vite **7.3.7**; Vitest **4.1.12**; Playwright **1.56.1** com Chromium **141.0.7390.37**. Viewports 1440×1000 e 390×844. As provas não foram executadas no Mac do usuário, em Safari, Firefox ou GPU WebGPU real.

| Comando / verificação                                              | Resultado real                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                                                         | **148 testes aprovados em 13 arquivos**; a base tinha 104 testes em cinco arquivos.                                                  |
| `npm run typecheck`                                                | Aprovado.                                                                                                                            |
| `npm run build`                                                    | Aprovado; site estático em `dist/`, fontes e licenças incluídas.                                                                     |
| `npm run format:check`                                             | Aprovado na entrega.                                                                                                                 |
| `git diff --cached --check` em código e documentação               | Sem erros nos arquivos próprios; textos integrais de licença preservam whitespace do upstream.                                       |
| E2E das quatro suítes de interface contra `vite preview`           | **14 cenários aprovados** no build de produção, em 46,8 s na rodada integrada.                                                       |
| E2E de `brand-library-storage.spec.ts` contra Vite dev             | **3 cenários aprovados**, em 2,5 s.                                                                                                  |
| Repetição do cenário mobile após ajustar a camada das notificações | **1/1 aprovado**, em 3,3 s; inserção pelo botão e retorno de foco conferidos. Esse é um dos 14 cenários, não uma contagem adicional. |
| Inspeção de PDF com Poppler/PyMuPDF e comparação com Chromium      | 12 páginas; texto, fontes, vetores, imagens e visual conferidos separadamente.                                                       |

O build informa comentários `@__PURE__` que o Rollup remove de Zod e um aviso de chunk grande do WebLLM opcional. Não são erros de compilação; o modelo/engine de IA continua fora da abertura normal. O Chromium precisou de permissão do ambiente para criar seus processos; os testes aprovados usaram a execução autorizada, sem alterar as restrições do produto.

### Reproduzir as jornadas

`npm run test:e2e` inicia Vite dev e executa todas as suítes. Para separar as mesmas rodadas utilizadas nesta entrega, mantenha um servidor de desenvolvimento e um preview de produção abertos:

```bash
npm run dev -- --port 5284
```

Em outro terminal, após o build:

```bash
npm run preview -- --port 5274
```

As quatro suítes de interface podem usar o build estático:

```bash
ZETTA_TEST_URL=http://127.0.0.1:5274 npm run test:e2e -- tests/e2e/workspace.spec.ts tests/e2e/charts.spec.ts tests/e2e/evolution.spec.ts tests/e2e/chart-safety.spec.ts
```

A suíte de armazenamento importa módulos TypeScript pelo Vite para simular concorrência e quota; portanto, precisa do servidor dev:

```bash
ZETTA_TEST_URL=http://127.0.0.1:5284 npm run test:e2e -- tests/e2e/brand-library-storage.spec.ts
```

Use `npx playwright install chromium` no ambiente de desenvolvimento, ou indique um Chromium existente com `ZETTA_BROWSER_PATH`. Esses comandos são para quem desenvolve/verifica o projeto; o usuário final abre a versão hospedada no navegador e não instala esses runtimes no Mac.

## Jornada integrada e regressões protegidas

As suítes cobrem texto e PDF digital → roteiro revisável → geração → edição → marca e imagens → gráficos/diagramas → desfazer/refazer → salvar/reabrir → backup/reimportação → apresentação → PDF. A entrada de PDF escaneado recebe orientação de texto selecionável, sem simular OCR.

- Um banco v1 é criado com o [backup real da 0.2](../tests/fixtures/legacy-v02.zetta.json). A versão nova abre o documento sem modificá-lo, cria os dois stores adicionais e mantém o store de apresentações.
- O mesmo perfil é aplicado em dois documentos. Um slide com imagem recortada é salvo e reutilizado com IDs novos, fonte e aparência incorporadas. Apagar o perfil da biblioteca não remove a marca dos documentos. O backup reimportado conserva esse estado.
- Dividir um texto longo conserva todos os caracteres, notas e origem. Prévia de roteiro não substitui o rascunho manual até a aplicação explícita. Desfazer/refazer recupera as composições.
- CSV com zero, negativos, vírgula decimal e colunas em outra ordem produz os valores escolhidos, sem substituir ausências por zero. A primeira linha exige escolha explícita. Treze linhas de dados excedem o limite de 12 e não são truncadas.
- Excluir um gráfico ou seu slide e desfazer recupera o texto e o formato numérico do rascunho ainda não aplicado. Rascunhos de elementos definitivamente removidos não bloqueiam a saída.
- Os quatro diagramas preservam campos estruturados após edição, backup e reimportação. A exportação de 11 slides com gráficos e diagramas foi novamente importada pelo PDF.js, recuperando `Ação e organização`, `1.250,75` e `18,5%`.
- Os limites de 20 marcas, 50 slides salvos e 64 MiB são conferidos em transação. Duas abas competindo pela última vaga não ultrapassam o limite. Uma falha simulada de quota preserva o registro anterior; excluir itens libera capacidade.
- Painéis longos têm rolagem própria. No viewport mobile, botões permanecem alcançáveis, a navegação por Tab fica no diálogo, Escape devolve o foco e notificações ficam abaixo dos painéis.

Falhas encontradas durante o desenvolvimento foram corrigidas antes da entrega: interpretação implícita de cabeçalho que descartava a primeira linha, limpeza prematura de rascunhos após exclusão e rodapés de painéis fora da área visível. Também foram ajustados seletores dos testes para corresponder aos botões realmente disponíveis e à nova estrutura SVG.

Capturas: [marca e recorte no player](validation/v0.3/brand-crop-player.png) e [biblioteca em tela pequena](validation/v0.3/mobile-library.png).

## PDF: três verificações independentes

A [prova completa de PDF](validation/v0.3/pdf.md) inclui o [arquivo gerado](validation/v0.3/searchable-proof.pdf), o [backup editável de 12 slides](validation/v0.3/pdf-proof.zetta.json), os relatórios e uma comparação visual do gráfico.

1. **Texto e fontes:** Poppler recupera acentos, cedilha, datas, `R$ 1.234,56`, `-8,5%` e `€ 24,99`. Quatro faces Liberation Sans/Serif aparecem incorporadas com mapeamento Unicode.
2. **Vetores:** PyMuPDF encontra desenhos e texto, com zero imagens colocadas nas páginas 2–11, que contêm os seis gráficos e os quatro diagramas. Fotografias e logos permanecem rasterizados. A ilustração decorativa da página 12 usa o fallback informado.
3. **Visual:** as 12 páginas foram renderizadas e inspecionadas. Recorte, fonte, alinhamento e valores permanecem visíveis; diferenças de antialiasing entre Chromium e Poppler não são tratadas como igualdade pixel a pixel.

O PDF mede 960×540 pt por página e tem 374.611 bytes nesta prova. Isso não garante que qualquer PDF novo será menor. Um glifo ausente bloqueia o modo pesquisável antes do download; não é removido silenciosamente. O modo imagem foi conferido em três páginas com zero caracteres extraíveis. Nenhum dos modos promete PPTX editável ou certificação PDF/UA.

## Desempenho observado

Três contextos novos por versão, mesmo Chromium, viewport 1440×1000, build de produção servido por HTTP local, sem limitação simulada de CPU/rede. Medidas de tempo são medianas de uma amostra pequena. Dados brutos: [antes](validation/v0.3/performance-before.json) e [depois](validation/v0.3/performance-after.json). Reprodução: [scripts/measure-browser.mjs](../scripts/measure-browser.mjs).

| Medida                                       |       0.2 |     0.3 |
| -------------------------------------------- | --------: | ------: |
| Arquivo JavaScript inicial, bytes            | 1.007.499 | 502.414 |
| Mesmo arquivo comprimido com gzip, bytes     |   334.046 | 157.225 |
| Home utilizável, mediana                     |    292 ms |  171 ms |
| Abrir laboratório e mostrar gráfico, mediana |    299 ms |  302 ms |
| Editar unidade e atualizar gráfico, mediana  |     40 ms |   52 ms |

O JavaScript inicial diminuiu **50,1% em bytes e 52,9% em gzip**. A home final solicitou apenas o entrypoint JavaScript; `chartRenderer` entrou quando o laboratório abriu. Seu chunk tem aproximadamente 551 kB, ou 190 kB gzip: esse custo foi adiado, não eliminado. O total da primeira experiência com gráficos continua próximo do anterior e inclui os recursos novos.

A abertura do laboratório ficou próxima da base nesta amostra, e a edição da unidade levou cerca de 12 ms a mais. Não há evidência aqui de melhoria de toda operação. Não foram medidos consumo de energia, memória prolongada, decks máximos em hardware fraco ou desempenho no Mac do usuário. A redução de download inicial é uma propriedade do build; os tempos não são uma garantia geral.

As fontes Liberation somam cerca de 1,59 MB sem compressão no site, mas só a família necessária, regular/negrito, é solicitada ao usar uma marca ou exportar. PDF.js, exportação e IA local continuam sob demanda. A GPU e os pesos de WebLLM não são ativados na abertura da aplicação.

## Alterações, dependências e recuperação

Os arquivos estão concentrados em contrato/validação, composição/briefing/origem, bibliotecas de marca/slides, recorte, gráficos e diagramas, exportação/fontes, integração do editor e testes. O [README](../README.md) apresenta os caminhos e o guia de experimentação; a [matriz de 14 referências](evolution-references.md) identifica commits, licenças, runtime, decisões e limites da pesquisa.

Única dependência direta adicionada: **svg2pdf.js 2.8.1**. O lockfile incorpora seus quatro pacotes transitivos (`cssesc`, `font-family-papandreou`, `specificity`, `svgpath`). ECharts 6.1.0 e jsPDF 4.2.1 foram mantidos. Os quatro TTF Liberation 2.1.5 são recursos estáticos licenciados; seus textos de licença e os avisos dos pacotes acompanham o build. Não foram incorporados os aplicativos completos pesquisados.

`schemaVersion: 1` aceita os campos opcionais novos; IndexedDB passa para v2. O backup inclui conteúdo, imagens, logo e aparência aplicada, mas não exporta toda a biblioteca nem os bytes das fontes estáticas. Uma versão antiga do app não lê necessariamente os novos documentos e pode receber `VersionError` ao abrir o banco v2 na mesma origem. O [guia de recuperação](processing-and-recovery.md) explica backup, mudança de domínio/perfil, quota e teste de versões anteriores sem apagar o banco como primeira medida.

O projeto continua estático e compatível com o preset Vite da Vercel: `npm run build`, saída `dist`, sem chave obrigatória. Hospedar o frontend permite usar o app sem instalação, mas edição, extração de PDF, gráficos e exportação continuam executando no navegador. Processamento remoto exige a infraestrutura e as decisões descritas na proposta separada.
