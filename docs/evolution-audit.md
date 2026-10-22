# Auditoria de evolução — Zetta

## Base confirmada antes das alterações

Inspeção em 22/10/2026. Base: main, commit `4f444c289d9eeb584be66c9949ef264739b7686c` (Zetta 0.2.0), checkout inicialmente limpo. Trabalho em `feat/composition-brand-vector-pdf`. Não foram encontradas instruções AGENTS.md no workspace do projeto.

A história a validar é: texto/PDF digital → roteiro revisável → documento estruturado → edição de composição/marca/imagens/dados → salvamento local/backup → apresentação → PDF. Esta aplicação não possui API própria ou banco remoto: a fronteira de dados é o IndexedDB do navegador.

### Confirmado no código

- React/TypeScript/Vite; documento schemaVersion 1, SVG compartilhado, IndexedDB, PDF.js, jsPDF4.2.1, ECharts6.1.0 e WebLLM opcional.
- Seis temas, oito layouts, seis tipos de gráficos e até três séries. A lista de recursos anterior ao anexo estava desatualizada para gráficos.
- O gerador usa regras e preserva a fonte; não executa reescrita semântica de documentos completos.
- As imagens de entrada são incorporadas ao documento. O recorte atual possui apenas fit e uma posição vertical.
- O PDF atual rasteriza cada slide em 2560×1440; não preserva o texto pesquisável.
- Gráficos são importados estaticamente por SlideCanvas/generator. O motor entra na carga inicial mesmo em uma tela sem gráficos.
- Marca reutilizável, biblioteca de slides, briefing por objetivo e diagramas estruturados ainda não existem.
- Não existem OCR, PPTX, contas, sincronização, backend, vídeos ou versões nomeadas persistentes.

### Estado de verificação

`npm test` foi executado novamente: **104 testes aprovados**, cinco arquivos. O commit base já possui sete jornadas de navegador validadas, com registro em [validation-2026-10-22.md](validation-2026-10-22.md). A nova etapa tem uma fixture exportada do documento v0.2, com dados fictícios, imagem incorporada e gráficos, para conferir compatibilidade.

Medição inicial no Chromium141.0.7390.37, build de produção via HTTP local, viewport1440×1000, três contextos novos: JavaScript inicial **1.007.499 bytes**, **334.046 bytes gzip**. Medianas observadas: home utilizável292ms; abrir laboratório e exibir gráfico299ms; editar unidade e atualizar gráfico40ms. São medidas deste ambiente, sem simulação de rede ou dispositivo. Não são garantia de desempenho no Mac do usuário.

## Seleção inicial e sequência

1. Preservar compatibilidade com campos opcionais validados e fixtures antigas.
2. Ações de composição com prévia, aplicação atômica e desfazer; incluir roteiro orientado por objetivo e origem preservada.
3. Perfis locais de marca, biblioteca de slides e enquadramento não destrutivo. Implementação nas estruturas atuais; react-easy-crop é referência avaliada, sem adoção inicial.
4. Processos, linhas do tempo, comparações e indicadores com dados estruturados e SVG próprio. Mermaid permanece candidato a diagramas mais complexos.
5. Manter ECharts como motor único e separar o engine do código leve de layout/validação. Completar a experiência de dados sem incorporar Vizzu ou Bklit Studio.
6. Prova e integração de PDF pesquisável com jsPDF existente e svg2pdf.js, condicionada à fidelidade verificada. Fontes suportadas incorporadas, com licença preservada, carregadas quando necessárias.
7. Validar a jornada integrada e registrar desempenho, compatibilidade e alcance do PDF.

A etapa opcional de console de apresentador/versões nomeadas fica após as prioridades centrais. Ela exige uma experiência separada de tela pública/notas e política própria de retenção; não será simulada por um botão ou pelo histórico da sessão.

A matriz completa das 14 referências é consolidada em arquivo separado com os relatórios da triagem. Os projetos completos não são instalados para a pesquisa. Não há contratação, envio de documentos para serviços novos nem publicação de produção nesta etapa.
