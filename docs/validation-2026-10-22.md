# Validação dos gráficos — Zetta 0.2.0

Verificação executada em 22/10/2026, sobre o build de produção da implementação de gráficos. Esta entrega usa ECharts 6.1.0, sem serviço externo de gráficos e sem executar modelos de IA nos testes.

## Resultado

- **104 testes unitários e de domínio aprovados**, em cinco arquivos.
- **Sete jornadas aprovadas no Chromium**, usando o build de produção servido localmente.
- TypeScript e build de produção aprovados.
- Formatação e diff revisados.
- Interface conferida em desktop (1440 × 1000) e celular (390 × 844); sem rolagem horizontal da página no cenário móvel.
- Nenhum erro JavaScript nem pedido HTTP para domínio externo no percurso manual tela inicial → laboratório → edição do gráfico.

Os sete cenários do navegador foram validados em duas rodadas. Duas seleções de campo nos testes precisaram passar a usar correspondência exata, pois “Dados do gráfico” também é parte de “Fonte dos dados do gráfico”. Os dois cenários foram executados novamente e passaram. Não há cenário pendente nessa bateria.

## Jornadas no navegador

| Cenário                   | Resultado observado                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seis tipos de gráfico     | Colunas, barras, linhas, área, pizza e rosca aparecem no editor; o laboratório abre sete slides.                                                             |
| Apresentação e PDF        | Animação de entrada, repetição e desativação funcionam; a preferência de movimento reduzido desativa o movimento. O download produz um PDF real.             |
| CSV, rascunho e séries    | Locale explícito, zeros e negativos preservados; troca de slide mantém rascunho; saída permite revisar; fonte do arquivo e preferência de valores persistem. |
| Tabela na geração         | Texto tabular gera gráfico com duas séries e mantém a fonte original.                                                                                        |
| Jornada principal         | Texto → roteiro → edição → desfazer/refazer → salvar/reabrir → apresentar → PDF → backup.                                                                    |
| PDF de entrada            | PDF digital é lido localmente; PDF sem texto recebe orientação para correção.                                                                                |
| Compatibilidade e celular | Gráfico vazio continua sendo um rascunho válido; dados aplicados e backup reabrem; criação funciona em viewport móvel.                                       |

As jornadas estão em [charts.spec.ts](../tests/e2e/charts.spec.ts) e [workspace.spec.ts](../tests/e2e/workspace.spec.ts). A tabela agrupa as verificações por comportamento; os arquivos contêm sete casos executáveis.

## Verificação visual adicional

Além das asserções de SVG e do fluxo de interface, os seis tipos foram renderizados no Chromium dentro do mesmo elemento SVG usado pelos slides. As capturas no começo e no fim diferiram, confirmando movimento real. Em cada fixture, a captura ao fim da animação coincidiu pixel a pixel com sua versão estática.

Um PDF de sete páginas foi baixado e inspecionado com os gráficos presentes, na proporção 16:9. A exportação solicita explicitamente o desenho estático, sem esperar ou capturar um instante intermediário da apresentação.

Foram medidos os limites e as colisões das caixas de texto para três séries de linhas coincidentes/próximas, barras agrupadas e valores da ordem de 1e-21. A colisão encontrada entre valores de linhas próximas foi corrigida com posicionamento conjunto por categoria, mantendo cada valor e sua associação à cor da série. Esses cenários terminaram sem sobreposição entre rótulos nem texto fora do quadro.

## O que esta validação não afirma

- A comparação por pixels é dos cenários examinados, não de todas as combinações possíveis de dados e temas.
- O produto usa animação de entrada; não implementa transformação animada entre tipos, bar-race nem tooltip interativo.
- PDF é uma saída estática rasterizada. O documento do Zetta e o backup preservam a edição estrutural.
- A bateria de navegador desta entrega usa Chromium. Não houve matriz completa de Safari, Firefox e dispositivos físicos.
- A pesquisa dos outros cinco projetos foi leitura de código e documentação. Seus aplicativos completos não foram instalados e comparados em execução.
- A inferência opcional com IA local não foi executada. Nenhum modelo foi baixado para esta validação.

## Reproduzir

Use Node.js 24, execute npm ci e depois npm test e npm run build. Para o navegador, instale Chromium com npx playwright install chromium e execute npm run test:e2e. ZETTA_TEST_URL permite apontar os testes para um servidor do build de produção; ZETTA_BROWSER_PATH permite escolher um executável já instalado.

Para conferir manualmente: abra **Experimentar gráficos**, selecione um gráfico, importe o [CSV de exemplo](../public/examples/dados-ficticios.csv), aplique os dados, apresente, baixe o PDF e depois exporte/reimporte o backup editável.
