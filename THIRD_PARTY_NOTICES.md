# Avisos de componentes de gráficos

O Zetta integra Apache ECharts 6.1.0 via npm, usando módulos de gráficos e o renderer SVG. O pacote é usado como dependência; seu código-fonte não foi modificado.

- **Apache ECharts — Apache License 2.0.** Copyright 2017–2026 The Apache Software Foundation. [Licença](public/licenses/echarts-LICENSE.txt) e [NOTICE](public/licenses/echarts-NOTICE.txt).
- **ZRender — BSD 3-Clause.** Dependência de renderização do ECharts. Copyright (c) 2017, Baidu Inc. [Licença](public/licenses/zrender-LICENSE.txt).
- **Trechos de D3 distribuídos pelo ECharts — BSD.** Copyright 2010–2016 Mike Bostock. [Aviso distribuído pelo pacote](public/licenses/echarts-d3-LICENSE.txt).

Esses arquivos são incluídos também no build estático, sob /licenses/.

## Referências estudadas

Presenton, SlideDeck AI, Banana Slides, Vizzu e Bklit UI foram examinados como referências de arquitetura e interface. Nenhum código, template, imagem ou componente desses cinco projetos foi incorporado nesta atualização.

O editor de dados, a integração, os layouts, as validações e o documento de demonstração foram implementados para o Zetta. O Studio do Bklit não foi copiado.

As demais dependências do projeto mantêm suas próprias licenças, disponíveis nos respectivos pacotes e identificadas no package-lock.json. Este arquivo registra os avisos específicos adicionados com a integração de gráficos; não altera a licença dos demais componentes.
