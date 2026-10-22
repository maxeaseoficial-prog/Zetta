# Zetta — análise de três referências de código

Inspeção em 22/10/2026. Leitura de README, licença e caminhos centrais pelo conector GitHub, fixados nos commits abaixo. Nenhum projeto foi instalado ou executado; nenhum código foi incorporado ao Zetta. A leitura confirma arquitetura e comportamentos de código, não a qualidade visual real de uma execução.

| Repositório              | Commit observado                           | Licença principal |
| ------------------------ | ------------------------------------------ | ----------------- |
| presenton/presenton      | `4e9d853cfac27e5330e62087dd9371d8b18e1534` | Apache-2.0        |
| barun-saha/slide-deck-ai | `9fa68d14e89c02c48be1bb22c6db0a537f65e029` | MIT               |
| Anionex/banana-slides    | `023cd54e0c28a116c662f6abdaf60a8dd5a41037` | AGPL-3.0          |

## Decisão recomendada

**Manter o formato `Deck` e o frontend do Zetta.** O atalho útil é aplicar padrões de modelagem e interação selecionados, mantendo números e elementos nativos editáveis. Nenhum dos três oferece uma substituição pronta que preserve simultaneamente o app atual, ausência de APIs externas e funcionamento apenas no navegador.

Prioridade: **Presenton como referência de modelo de elementos, gráficos e templates; SlideDeck AI como referência simples de pipeline JSON → PPTX; Banana Slides como referência de direção visual e de fluxo de revisão por página.** Não substituir a fonte estruturada do Zetta por imagens de slides nem introduzir OCR para reconstruir elementos que já temos como dados.

## 1. Presenton

### O que o código confirma

- Aplicativo Next.js/React com backend FastAPI e persistência SQL. `SlideModel` possui `content` JSON, `ui` JSON, `html_content`, `speaker_note`, propriedades e identificação de layout. A fonte editável tem estrutura; não é apenas um conjunto de PNGs.
- O modelo de elementos inclui texto/runs, imagens, listas, tabelas, vetores, gráficos com categorias/séries e infográficos. A biblioteca do editor usa Konva/React-Konva, Tiptap e módulos de gráficos.
- A geração de conteúdo deriva um schema do layout, pede resposta estruturada e valida/reexecuta a chamada. O pipeline de templates separa estrutura/decorativos do conteúdo editável. O guia Template V2 descreve importação de PPTX com JSON de elementos e imagens de preview, passes visuais e limites de texto. Esse processo depende de um modelo com visão; não é uma simples leitura de PPTX disponível gratuitamente no browser.
- Ollama e LM Studio têm caminhos explícitos no código. Ollama usa endpoint HTTP local, por padrão `http://localhost:11434/v1`, com chave técnica fixa `ollama`; não exige uma chave paga de provedor. Ainda requer serviço/modelo instalado fora do frontend. Imagens podem usar ComfyUI/Open WebUI configurados separadamente. Provedores de nuvem e bancos de imagens usam suas respectivas credenciais. O README avisa que a galeria Community é remota por padrão e precisa ser desativada em ambiente isolado.

### Achado material: exportação separada

O app não contém simplesmente uma função TypeScript de exportação reutilizável no navegador. `run-bundled-presentation-export.ts` cria um arquivo de tarefa e inicia um processo Node. `sync-presentation-export.cjs` busca um pacote externo fixado por `presentationExportVersion`.

Inspecionei o tarball **como dados**, sem instalar/executar:

- URL: https://github.com/presenton/presenton-export/releases/download/v1.0.34/presenton-export-core-opensource-1.0.34.tgz
- SHA-256: `17c5aef592721d996a4f658de03282764d0ba900ab01beb7ca10a0404d595079`
- Arquivos: `package/dist/index.js`, `package/dist/index.d.ts`, `package/package.json`, `package/README.md`.
- O README declara duas edições: a edição `opensource` suporta somente exportação `low-quality`; a edição completa oferece também `high-quality`. Isso é nomenclatura do pacote, não uma medição nossa da saída.
- O README declara bundle ofuscado; o pacote traz `javascript-obfuscator` nas devDependencies. O repositório público `presenton/presenton-export` contém apenas README e releases.
- **Não encontrei arquivo LICENSE nem campo `license` no package.json desse tarball.** A licença Apache do aplicativo não deve ser automaticamente atribuída a esse pacote separado. Sua permissão e condições de reutilização precisam ser esclarecidas antes de adotá-lo.
- Dependências incluem Node, Puppeteer, Sharp, pdf-lib e `@office-open/pptx`; não é um pacote que possa ser conectado diretamente ao Vite/browser do Zetta. Há tarefas declaradas para JSON/PPTX/PDF, mas não executei nem confirmei a fidelidade/editabilidade de todos os tipos na saída.

### O que aproveitar

1. Contrato explícito de gráfico: categorias, séries, unidade, cores, legenda, eixos e rótulos; separar dados de apresentação.
2. Templates de geometria conhecida com capacidade de texto, hidratados por conteúdo validado.
3. Editor de dados e propriedades separado do renderer, com o mesmo documento para preview/export.
4. Validação de JSON e retries como barreira entre modelo e documento editável.

**Não copiar cegamente os normalizadores de gráficos.** `chart-model.ts` e `chart-data.ts` criam séries/categorias padrão, preenchem valores ausentes com zero e cortam quantidades. O Zetta exige rejeitar dados inválidos sem fabricá-los ou descartá-los. O contrato e a organização são úteis; esses defaults específicos conflitam com nosso requisito.

### Evidência

- [README](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/README.md)
- [Modelo SQL de slide](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/models/sql/slide.py)
- [Elementos tipados](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/templates/v2/models/elements.py)
- [Schema e geração](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/utils/llm_calls/generate_slide_content.py)
- [Configuração local/nuvem](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/utils/llm_config.py)
- [Imagem/ComfyUI](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/fastapi/services/image_generation_service.py)
- [Arquitetura Template V2](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/docs/template-v2.md)
- [Normalização dos gráficos](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/nextjs/components/slide-editor/model/chart-model.ts) e [dados](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/nextjs/components/slide-editor/charts/chart-data.ts)
- [Instalação do runtime de exportação](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/scripts/sync-presentation-export.cjs) e [execução isolada](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/servers/nextjs/lib/run-bundled-presentation-export.ts)
- [LICENSE](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/LICENSE) e [NOTICE](https://github.com/presenton/presenton/blob/4e9d853cfac27e5330e62087dd9371d8b18e1534/NOTICE)

## 2. SlideDeck AI

### O que o código confirma

- App Streamlit e biblioteca Python. `core.py` constrói um prompt, recebe texto do LLM, tenta interpretar/reparar JSON e chama `python-pptx`.
- O JSON descreve títulos, bullets aninhados, tabelas, duas colunas, processos e termos para imagens. É uma fonte estruturada relativamente simples; o fluxo de revisão por chat regenera o PPTX. Não encontrei editor visual de objetos equivalente ao editor atual do Zetta nesse caminho principal.
- `pptx_helper.py` cria títulos, parágrafos, tabelas, textboxes, formas e imagens com `python-pptx`: isso confirma elementos nativos para os casos implementados, não slides inteiros rasterizados. O caminho principal inspecionado não possui criação de gráficos nativos nem exportação PDF. PDF é **entrada** via `pypdf.extract_text()`, com faixa de páginas; não há OCR nem reconstrução de layout nesse leitor.
- Modo Ollama explícito (`RUN_IN_OFFLINE_MODE`), sem chave de provedor para o texto. O mecanismo ainda requer Python e o serviço local. Busca de imagens usa Pexels HTTP e `PEXEL_API_KEY`; sem chave, devolve resultado vazio. O próprio README distingue LLM offline de operação completamente sem internet.
- Templates `.pptx` usam Git LFS. A leitura do clone normal traria ponteiros, e não basta supor que todos os assets são baixados ou estão cobertos pela licença do código.

### O que aproveitar e evitar

Bom material para simplificar nosso pipeline conteúdo → schema → renderer e para estudar um futuro adaptador de PPTX nativo. O prompt é portável como ideia para um modelo local no browser; a biblioteca Python não é uma melhoria encaixável no frontend atual sem uma nova camada de execução.

Não copiar o comportamento de capturar qualquer exceção e continuar com o próximo slide: em `generate_powerpoint_presentation`, isso pode produzir um deck com slides ausentes. Também não equiparar instrução textual de schema a validação rígida: o core usa parser JSON5 e tentativa de reparo, não prova de fidelidade dos dados.

### Evidência

- [README e Ollama](https://github.com/barun-saha/slide-deck-ai/blob/9fa68d14e89c02c48be1bb22c6db0a537f65e029/README.md)
- [Pipeline](https://github.com/barun-saha/slide-deck-ai/blob/9fa68d14e89c02c48be1bb22c6db0a537f65e029/src/slidedeckai/core.py)
- [PPTX nativo](https://github.com/barun-saha/slide-deck-ai/blob/9fa68d14e89c02c48be1bb22c6db0a537f65e029/src/slidedeckai/helpers/pptx_helper.py)
- [LLMs/Ollama](https://github.com/barun-saha/slide-deck-ai/blob/9fa68d14e89c02c48be1bb22c6db0a537f65e029/src/slidedeckai/helpers/llm_helper.py)
- [Pexels](https://github.com/barun-saha/slide-deck-ai/blob/9fa68d14e89c02c48be1bb22c6db0a537f65e029/src/slidedeckai/helpers/image_search.py)
- [Leitor PDF](https://github.com/barun-saha/slide-deck-ai/blob/9fa68d14e89c02c48be1bb22c6db0a537f65e029/src/slidedeckai/helpers/file_manager.py)
- [Prompt/schema](https://github.com/barun-saha/slide-deck-ai/blob/9fa68d14e89c02c48be1bb22c6db0a537f65e029/src/slidedeckai/prompts/initial_template_v4_two_cols_img.txt)
- [MIT](https://github.com/barun-saha/slide-deck-ai/blob/9fa68d14e89c02c48be1bb22c6db0a537f65e029/LICENSE)

## 3. Banana Slides

### O que o código confirma

- Backend Flask/Python com frontend React. A página persiste `outline_content`, `description_content`, `generated_image_path`, thumbnail e versões de imagem. O preview exibe a imagem da página.
- A exportação normal `create_pptx_from_images` adiciona **uma imagem cobrindo o slide**; o PDF usa `img2pdf`, com fallback Pillow. Esse PPTX normal não oferece caixas de texto, gráficos ou tabelas semânticas editáveis.
- Existe uma exportação editável separada e real no código: `create_editable_pptx_with_recursive_analysis` chama `ImageEditabilityService`, identifica elementos, recorta imagens, estima estilos e reconstrói texto/objetos com `PPTXBuilder`; usa background limpo por inpainting. Isso é reconstrução de imagem, sujeita a erros de reconhecimento e estilo, e não preservação direta dos elementos originais.
- Os provedores configurados usam credenciais de Gemini/OpenAI/Anthropic/Vertex/outros ou autenticação OAuth; o caminho LazyLLM chama `OnlineModule`. Endpoint compatível pode ser configurado, mas não encontrei inferência local no browser nem um caminho integrado sem serviço externo equivalente ao nosso modo por regras.
- Importação de arquivos não textuais no caminho principal passa pelo serviço MinerU, com token, upload e polling de resultado. O serviço tem leitura direta para texto e planilhas. Isso conflita com a política atual de manter PDFs locais do Zetta.

### O que aproveitar

Estudar separação entre roteiro, descrição visual, preview, revisão e versões por página; referências de estilo e regeneração localizada. Para o Zetta, ilustrações e fotos podem ser imagens, mas texto, dados e gráficos devem continuar nativos. Migrar para esse motor de imagens para depois aplicar OCR seria uma regressão de editabilidade e custo/complexidade.

### Evidência

- [README](https://github.com/Anionex/banana-slides/blob/023cd54e0c28a116c662f6abdaf60a8dd5a41037/README_EN.md)
- [Modelo da página](https://github.com/Anionex/banana-slides/blob/023cd54e0c28a116c662f6abdaf60a8dd5a41037/backend/models/page.py)
- [Preview baseado em imagem](https://github.com/Anionex/banana-slides/blob/023cd54e0c28a116c662f6abdaf60a8dd5a41037/frontend/src/components/preview/SlideCard.tsx)
- [Dois caminhos de exportação](https://github.com/Anionex/banana-slides/blob/023cd54e0c28a116c662f6abdaf60a8dd5a41037/backend/services/export_service.py)
- [Reconstrução editável](https://github.com/Anionex/banana-slides/blob/023cd54e0c28a116c662f6abdaf60a8dd5a41037/backend/services/image_editability/service.py) e [extratores](https://github.com/Anionex/banana-slides/blob/023cd54e0c28a116c662f6abdaf60a8dd5a41037/backend/services/image_editability/factories.py)
- [Provedores](https://github.com/Anionex/banana-slides/blob/023cd54e0c28a116c662f6abdaf60a8dd5a41037/backend/services/ai_providers/__init__.py) e [configuração](https://github.com/Anionex/banana-slides/blob/023cd54e0c28a116c662f6abdaf60a8dd5a41037/backend/config.py)
- [MinerU/importação](https://github.com/Anionex/banana-slides/blob/023cd54e0c28a116c662f6abdaf60a8dd5a41037/backend/services/file_parser_service.py)
- [AGPL-3.0, especialmente seção 13](https://github.com/Anionex/banana-slides/blob/023cd54e0c28a116c662f6abdaf60a8dd5a41037/LICENSE)

## Licenças e implementação própria

- **Presenton/Apache-2.0:** reutilização de código do app pode ser compatível com produto comercial próprio, mantendo cópia da licença, avisos aplicáveis de copyright/atribuição e NOTICE, e identificando arquivos modificados. Conferir também dependências/assets. A questão do export-core separado permanece aberta.
- **SlideDeck AI/MIT:** preservar copyright e aviso de permissão nas cópias/porções substanciais. Conferir licenças de imagens, ícones e templates separadamente; licença do código não torna todo conteúdo visual irrestrito.
- **Banana/AGPL-3.0:** não proíbe uso comercial. Porém, modificar/incorporar código como obra derivada e oferecê-lo pela rede traz obrigações de disponibilizar a fonte correspondente aos usuários; distribuição tem outras obrigações da licença. O README anuncia autorização específica para uso comercial fechado. Não copiar módulos para um Zetta fechado sem resolver essa condição. Estudar ideias e implementar solução própria é o caminho recomendado aqui; isso não equivale a relicenciar código copiado.

## Próximos ganhos concretos para o Zetta sem APIs externas

1. Expandir gráficos nativos com schema explícito e editor tabular rigoroso, preservando zeros/negativos/unidades/séries, com erros de importação claros.
2. Adicionar biblioteca própria de layouts semânticos (comparação, tabela, processo, números, gráfico) com limites de conteúdo e preview compartilhado.
3. Separar narrativa e intenção visual do conteúdo factual; usar IA local opcional para texto e layout, nunca para inventar valores.
4. Manter exportações consistentes a partir do mesmo documento estruturado. Avaliar PPTX nativo em etapa própria, com adaptador e testes de conteúdo/editabilidade; não adotar um exportador externo só por uma promessa no README.

Não há evidência nesta leitura para prometer ganho visual automático ao copiar um desses repositórios. O ganho de prazo está em evitar decisões erradas e aproveitar contratos e fluxos já concretizados, sem substituir o núcleo que hoje garante edição e processamento local.
