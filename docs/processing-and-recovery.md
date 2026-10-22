# Processamento, recuperação e expansões

## Onde o trabalho acontece

O Zetta continua sendo um frontend estático. Publicá-lo na Vercel elimina a necessidade de instalar o projeto no Mac para utilizá-lo. **Isso não transfere o processamento dos documentos para os servidores da Vercel.** O navegador recebe o aplicativo e executa suas operações locais.

| Tarefa                                  | Execução atual                              | Medida desta etapa                                                                           | O que seria necessário para execução remota                                                   |
| --------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Extrair texto de PDF digital            | PDF.js no navegador, com worker             | Mesmos limites de páginas, bytes e caracteres; nenhum OCR automático                         | Upload autorizado para serviço de extração, limites e fila própria                            |
| Organizar roteiro por regras            | JavaScript no navegador                     | Objetivo/público alteram a prioridade dos tópicos; prévia antes de substituir                | Poderia rodar em servidor, mas a regra é pequena e não exige essa infraestrutura              |
| Editar texto, layout, marca e diagramas | React/SVG no navegador                      | Documento estruturado; prévias e aplicação explícita, sem modelo                             | A interface permanece local mesmo com backend; estado remoto serviria para sincronização      |
| Importar e conferir CSV                 | JavaScript no navegador                     | Prévia limitada; seleção de colunas; sem truncamento de linhas ou preenchimento de ausências | Serviço de transformação de dados se houver operações muito maiores, com revisão do resultado |
| Renderizar gráficos                     | ECharts no navegador                        | Engine carregada somente quando há gráfico; dados continuam no documento                     | Renderer remoto para imagens/exportação, sem eliminar a edição local                          |
| Logo, imagem e recorte                  | Decodificação/Canvas/SVG no navegador       | Zoom e posição persistidos; recorte não recodifica a imagem a cada ajuste                    | Normalização/OCR remoto apenas se autorizado; bytes da imagem seriam enviados                 |
| Salvar documentos e biblioteca          | IndexedDB do navegador                      | Migração aditiva, recursos incorporados ao documento, backups independentes                  | Banco/armazenamento remoto, autenticação e política de sincronização                          |
| Gerar PDF                               | jsPDF/svg2pdf e fontes locais no navegador  | Módulos/fontes sob demanda, estado final estático, controle de overflow                      | Worker com navegador/headless e as mesmas fontes; fila e armazenamento temporário             |
| Revisar trecho com IA opcional          | WebLLM em worker, usando GPU do dispositivo | Continua desligada por padrão; download apenas por ação explícita                            | Modelo em serviço próprio ou provedor. Requer envio do trecho e infraestrutura definida       |

Worker ajuda a manter a interface responsiva, mas continua usando a máquina do usuário. Animações de apresentação respeitam a preferência de movimento reduzido; não são uma renderização de vídeo ou uma inferência de IA.

As fontes de marca vêm do próprio site como quatro arquivos TTF de Liberation Sans e Liberation Serif 2.1.5, licenciados sob OFL 1.1. O aplicativo carrega sob demanda apenas o par regular/negrito da família necessária. Os documentos e textos não são enviados a um serviço de fontes. A inferência experimental usa arquivos de modelo externos somente se ativada; ela não foi convertida em recurso obrigatório.

## Recuperação e compatibilidade

### Documento

- `schemaVersion` permanece **1**. Os campos novos são opcionais e validados: marca, aparência por slide, recorte, briefing, origem, perguntas e diagramas.
- Backups anteriores abrem sem exigir que os campos novos existam. A aplicação não precisa consultar a biblioteca para renderizar uma marca/slide já incorporado.
- Não prometemos abrir um backup 0.3 em um leitor 0.2 antigo: o leitor antigo é estrito e desconhece os novos campos. Preserve uma cópia do backup original antes de voltar a uma versão anterior do app.
- Importar um backup cria outro documento. Um arquivo inválido é rejeitado sem substituir o documento existente.
- A origem preserva trecho/nome/páginas; o PDF original não é armazenado. Ela permite conferência, sem certificação de verdade ou link fictício para uma página ausente.
- Slides reutilizados recebem novos IDs e `sourcePages=[]` no destino. Páginas da fonte anterior ficam em `origin.pages`, junto do nome/trecho, para não serem confundidas com o PDF do novo documento.

Os limites do documento são independentes dos limites da biblioteca:

| Recurso                      | Limite                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| Apresentação                 | Até 50 slides e 6 blocos por slide                                                        |
| Imagem ou logo incorporado   | Até 5 MiB por recurso, em PNG, JPEG ou WebP                                               |
| Imagens e logos no documento | Até 20 MiB no conjunto, incluindo a marca do documento e os snapshots de marca dos slides |
| Backup `.zetta.json`         | Até 32 MiB no JSON serializado                                                            |

O envio de imagem/logo aceita arquivo de até 12 MiB e normaliza sua resolução para no máximo 2.000 pixels no maior lado, antes de incorporar o resultado ao documento. Aplicar uma marca ou inserir um slide salvo valida novamente o documento completo, incluindo o tamanho do backup. Um item que cabe na biblioteca ainda pode exceder o limite da apresentação de destino. Cópias incorporadas, inclusive logos repetidos em snapshots, entram no orçamento; não há deduplicação persistente desses recursos.

### Fontes e recuperação do PDF

O backup guarda a escolha de fonte `sans` ou `serif`; os bytes dos TTF acompanham o aplicativo, não o arquivo `.zetta.json`. Ao abrir o backup em outra instalação do Zetta, essa instalação precisa servir os arquivos de fonte estáticos correspondentes. Nenhuma consulta a um perfil da biblioteca é necessária para recuperar nome, cores, logo ou rodapé já incorporados.

No PDF pesquisável, o aplicativo incorpora as fontes Liberation. Para slides legados, informa a substituição de Arial por Liberation Sans e de Georgia por Liberation Serif somente no PDF; o documento e sua aparência no editor permanecem com a configuração anterior. Se a fonte não carregar, a incorporação falhar ou um caractere não tiver glifo disponível, a exportação é interrompida. Corrija o conteúdo/recurso ou tente novamente após resolver o carregamento. Também é possível escolher explicitamente **PDF como imagem** para preservar a aparência renderizada, com texto sem pesquisa ou seleção; esse modo também precisa carregar as fontes de marca usadas no slide. A exportação não troca silenciosamente de modo nem baixa um PDF parcial após falha.

### IndexedDB

O banco **zetta-local** passa da versão **1 para 2**, acrescentando `brandProfiles` e `reusableSlides`. O store `decks` e seu índice são mantidos. A migração não apaga nem recria apresentações.

Essa versão do banco é separada de `schemaVersion: 1` dos documentos. A versão 0.2 do aplicativo pede explicitamente um banco de versão 1: depois da migração, voltar ao aplicativo antigo na mesma origem pode produzir `VersionError`, inclusive para apresentações sem campos novos. Não há downgrade automático do IndexedDB. Preserve os backups originais e exporte os documentos pela versão atual antes de testar uma versão antiga. Use outra origem ou outro perfil de navegador para esse teste; apagar o banco não deve ser a primeira medida de recuperação.

O armazenamento pertence à origem do site — protocolo, domínio e porta — e ao perfil do navegador. Outra URL de preview, domínio de produção ou porta local usa dados separados, mesmo no mesmo computador. Não há sincronização entre essas origens. Limpar os dados do site, usar navegação privada ou uma remoção de armazenamento pelo navegador pode eliminar os dados locais; mantenha backups fora do navegador.

Limites da biblioteca: **20 perfis**, **50 slides reutilizáveis**, **64 MiB** no total serializado, incluindo a representação base64 das imagens. A conferência de quantidade/bytes e a gravação acontecem na mesma transação. O limite inclui os recursos embutidos em cada item; ultrapassá-lo produz erro, sem expulsar automaticamente itens anteriores. Os 64 MiB são um teto do aplicativo, não uma reserva de espaço garantida: a quota disponível ou uma restrição do navegador pode impedir uma gravação antes desse teto.

Apagar um perfil ou slide da biblioteca não altera documentos que já contêm sua cópia. O backup `.zetta.json` leva os recursos da apresentação, mas não é uma exportação de toda a biblioteca. Para recuperar o trabalho em outro navegador, importe os backups e, se quiser, salve novamente os perfis/slides na biblioteca desse navegador.

Se ocorrer falha de armazenamento, baixe o backup antes de limpar dados ou trocar de navegador. Desfazer/refazer é histórico da sessão, não um conjunto de versões persistentes. O backup preserva somente as alterações já aplicadas; rascunhos de CSV ainda não aplicados pertencem à sessão de edição.

## Propostas futuras, sem implantação nesta etapa

Estas propostas não ativam upload, conta, contratação ou processamento remoto. O fluxo básico atual continua disponível sem qualquer uma delas.

| Expansão                             | Tarefa e motivo                                                     | Serviço próprio possível / dependências verificáveis                                                                                                      | Dados enviados e retorno                                                                                                      | Custos operacionais a dimensionar                                                                        |
| ------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| IA semântica para documentos maiores | Reduzir carga de modelo/GPU no dispositivo e reescrever sob revisão | Worker com modelo cuja licença/qualidade seja validada ou provedor escolhido; contrato de saída JSON validado contra o documento                          | Trechos selecionados, objetivo e instruções; retorna roteiro proposto, fontes e perguntas, nunca substitui diretamente o deck | CPU/GPU ou tokens, memória, concorrência, armazenamento e tráfego; modelo/provedor ainda não escolhidos  |
| OCR                                  | Ler PDFs escaneados que o fluxo atual rejeita                       | Container CPU com OCR e rasterização de páginas; fila com limite de resolução/tempo. Tesseract ou outro motor dependeria de prova com os documentos reais | PDF/imagens autorizados; retorna texto com páginas e avisos de confiança. Revisão antes de gerar slides                       | CPU por página, armazenamento temporário e tráfego; sem preço estimado antes da amostra de carga         |
| PDF pesado                           | Remover conversão prolongada do navegador em decks grandes          | Worker Node com navegador headless, versão fixa do renderer e mesmas fontes. O SVG/PDF atual é referência, não um endpoint já existente                   | Snapshot `.zetta.json` e imagens incorporadas; retorna PDF e relatório de avisos                                              | Memória/CPU por job, tempo de navegador, fila, armazenamento/egress                                      |
| Vídeo ou ranking temporal            | Renderizar frames/codecs sem ocupar o Mac                           | Worker Python/Manim/PyAV para avaliar Vizreel; Python/pandas/matplotlib e writer para bar_chart_race. Ver [matriz](evolution-references.md)               | Dataset temporal, tema, dimensões/duração; retorna vídeo e frame final. Não substitui dados editáveis                         | Tempo de render por duração/resolução, codecs, volume de frames e armazenamento; custo só após benchmark |
| PPTX                                 | Criar um arquivo editável em outro aplicativo                       | Adaptador específico para objetos nativos; considerar python-pptx/PptxGenJS com prova de tipografia/crop/charts. Não é resultado automático do PDF        | Snapshot do documento; retorna PPTX com relatório dos elementos que precisarem de imagem                                      | Conversão/validação e manutenção do adaptador; runtime depende da abordagem                              |

### Fluxo proposto para um serviço opcional

1. O usuário escolhe a operação e vê quais arquivos/trechos serão enviados.
2. O app envia um snapshot e recebe um identificador de tarefa, com limite de tamanho e de concorrência.
3. Uma fila entrega a tarefa a um worker com timeout, versão fixa e credenciais restritas. A interface acompanha progresso e oferece cancelar.
4. Cancelamento interrompe novas etapas e sinaliza o worker ativo; não prometer interrupção instantânea de qualquer codec/modelo. Inputs temporários são removidos ao encerrar o job.
5. O retorno passa pela validação do Zetta e aparece como prévia. Aplicar cria uma operação reversível no documento.
6. Proposta inicial de retenção para discussão: remover inputs após conclusão/cancelamento; saída disponível por até 24 horas para download; somente metadados mínimos de diagnóstico por sete dias. Esses prazos são proposta, não uma política já implementada. O provedor escolhido precisará suportar exclusão e tratamento compatíveis.

Antes de contratar ou ativar, faltam: amostra representativa, qualidade mínima, teto de custo/concorrência, região dos dados, modelo/motor, tratamento de logs e credenciais, política de retenção e consentimento. Nenhuma decisão aqui obriga o usuário a instalar runtimes ou modelos no Mac.

## Apresentador com notas e versões nomeadas

Adiadas como etapa opcional. O player atual permanece a tela pública. Um console de apresentador precisa de outra janela, canal de sincronização de navegação, próximo slide/cronômetro e testes para impedir notas na janela do público.

Versões locais nomeadas precisam de política de retenção/limites e snapshots recuperáveis, preferencialmente com deduplicação dos recursos. Restaurar deve preservar a versão atual como ponto de recuperação. Não requer contas por si só; também não será apresentado como recurso existente apenas porque há botões de desfazer/refazer.
