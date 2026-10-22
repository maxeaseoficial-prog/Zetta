# Avisos de componentes e fontes

O Zetta integra Apache ECharts 6.1.0 via npm, usando módulos de gráficos e o renderer SVG. O pacote é usado como dependência; seu código-fonte não foi modificado.

- **Apache ECharts — Apache License 2.0.** Copyright 2017–2026 The Apache Software Foundation. [Licença](public/licenses/echarts-LICENSE.txt) e [NOTICE](public/licenses/echarts-NOTICE.txt).
- **ZRender — BSD 3-Clause.** Dependência de renderização do ECharts. Copyright (c) 2017, Baidu Inc. [Licença](public/licenses/zrender-LICENSE.txt).
- **Trechos de D3 distribuídos pelo ECharts — BSD.** Copyright 2010–2016 Mike Bostock. [Aviso distribuído pelo pacote](public/licenses/echarts-d3-LICENSE.txt).

Esses arquivos são incluídos também no build estático, sob /licenses/.

## PDF e tipografia

- **svg2pdf.js 2.8.1 — MIT.** Copyright (c) 2015–2026 yWorks GmbH; Copyright (c) 2013–2015 Vitaly Puzrin. Usado como dependência, sem modificar seu código. A [licença integral](public/licenses/svg2pdf-LICENSE.txt) acompanha o build.
- **jsPDF 4.2.1 — MIT.** Copyright (c) 2010-2025 James Hall, https://github.com/MrRio/jsPDF; Copyright (c) 2015-2025 yWorks GmbH, https://www.yworks.com/. A [licença integral distribuída pelo pacote instalado](public/licenses/jspdf-LICENSE.txt) acompanha o build.
- **Liberation Fonts 2.1.5 — SIL Open Font License 1.1.** Digitized data copyright (c) 2010 Google Corporation, nomes reservados Arimo, Tinos e Cousine; Copyright (c) 2012 Red Hat, Inc., nome reservado Liberation. Quatro TTF originais, não modificados: Sans Regular/Bold e Serif Regular/Bold. Arquivos e [licença integral](public/fonts/Liberation-LICENSE.txt) acompanham o aplicativo sob /fonts/. São carregados quando uma marca ou exportação usa a família e incorporados ao PDF.

Arial e Georgia não são redistribuídas; decks legados usam as fontes disponíveis no dispositivo, com substituição declarada por Liberation no PDF pesquisável.

### Dependências transitivas de svg2pdf.js

Os avisos abaixo foram copiados integralmente, sem alteração, dos arquivos de licença das versões instaladas. Acompanham o build estático sob `/licenses/`.

- **cssesc 3.0.0 — MIT.** Copyright Mathias Bynens <https://mathiasbynens.be/>. [Licença integral](public/licenses/cssesc-LICENSE.txt), copiada de `LICENSE-MIT.txt`.
- **font-family-papandreou 0.2.0-patch2 — MIT.** Copyright (c) 2015 Taro Hanamura. [Licença integral](public/licenses/font-family-papandreou-LICENSE.txt), copiada de `LICENSE`.
- **specificity 0.4.1 — MIT.** Copyright (c) 2016 Keegan Street and others. [Licença integral](public/licenses/specificity-LICENSE.txt), copiada de `LICENSE`.
- **svgpath 2.6.0 — MIT.** Copyright (C) 2013-2015 by Vitaly Puzrin. [Licença integral](public/licenses/svgpath-LICENSE.txt), copiada de `LICENSE`.

## Referências estudadas

Presenton, SlideDeck AI, Banana Slides, Vizzu e Bklit UI foram examinados como referências de arquitetura e interface. Nenhum código, template, imagem ou componente desses cinco projetos foi incorporado nesta atualização.

Mermaid, react-easy-crop, Presentation AI, Data Formulator, Vizreel e bar_chart_race também foram examinados, sem incorporação de código. Os blocos estruturados, a composição, o recorte e a biblioteca de marca/slides desta etapa são implementações próprias sobre o contrato do Zetta. A [matriz de pesquisa](docs/evolution-references.md) fixa versões, commits e arquivos examinados.

O editor de dados, a integração, os layouts, as validações e o documento de demonstração foram implementados para o Zetta. O Studio do Bklit não foi copiado.

As demais dependências do projeto mantêm suas próprias licenças, disponíveis nos respectivos pacotes e identificadas no package-lock.json. Este arquivo registra os avisos específicos das integrações de gráficos, PDF e tipografia; não altera a licença dos demais componentes.
