# Cápsula Sonora — análise musical 100% local

Um dashboard React para explorar anos de histórico de reprodução e gerar um cartão vertical compartilhável — sem backend, sem conta e sem enviar seus dados musicais para a internet.

## O que o projeto faz

- Abre **CSV e Parquet diretamente no navegador** com DuckDB-WASM.
- Detecta automaticamente o schema do Extended Streaming History do Spotify e nomes genéricos.
- Permite confirmar ou corrigir o mapeamento antes de processar os dados.
- Remove linhas sem data/artista/música e duplicatas exatas após a normalização.
- Aplica um tempo mínimo por reprodução (30 segundos por padrão).
- Mantém agregações no DuckDB; não transfere milhões de linhas para o React.
- Exibe KPIs, rankings, evolução temporal, bump chart, heatmaps, descoberta, fidelidade e comparação com o período anterior.
- Gera uma Cápsula Sonora em PNG 1080 × 1920, com capa procedural ou foto local, e também pode copiá-la para a área de transferência.

## Privacidade e funcionamento local

O arquivo selecionado é registrado diretamente no DuckDB-WASM dentro da aba. Consultas SQL e agregações rodam no navegador; o app não possui endpoints, login, telemetria ou chamadas para um backend. DuckDB-WASM, seus workers e WebAssembly são empacotados pelo Vite e servidos pela própria aplicação — não dependem de CDN em tempo de execução. A tipografia usa a pilha local `Inter`/`system-ui`; quando Inter não estiver instalada, o navegador usa a fonte sans-serif do sistema.

> Observação: como em qualquer aplicação web, extensões instaladas no navegador são externas ao controle deste projeto. Para o maior isolamento, execute em um perfil de navegador limpo e mantenha o app em `localhost`.

## Tecnologias

- Vite + React 18 + TypeScript
- Tailwind CSS
- DuckDB-WASM para leitura de Parquet/CSV e SQL analítico
- Recharts para gráficos
- Zustand para estado global
- date-fns para datas
- html-to-image para PNG/clipboard

### Por que DuckDB-WASM?

Ele lê Parquet de forma nativa, detecta CSV, faz filtros/`GROUP BY`/funções de janela sem copiar todo o dataset para objetos JavaScript e mantém o processamento na máquina. Isso é mais apropriado para milhões de linhas do que parsers CSV tradicionais seguidos de agregações no React. A tabela normalizada é materializada uma vez para evitar repetir limpeza e deduplicação em cada gráfico.

## Pré-requisitos

- Node.js 20 ou mais recente (Node 18.18+ também funciona com as versões fixadas)
- npm 9+
- Navegador moderno: Chrome, Edge ou Firefox atualizado
- Memória suficiente para o arquivo. CSVs muito grandes usam mais memória que Parquet; prefira Parquet quando possível.

## Instalação e execução

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite, normalmente <http://localhost:5173>.

Para validar a versão de produção:

```bash
npm run build
npm run preview
```

## Teste rápido com `sample.csv`

O arquivo `public/sample.csv` contém **2.000 reproduções fictícias** distribuídas entre 2012 e 2025.

1. Inicie o app.
2. Na tela inicial, clique em **Baixar sample.csv** ou selecione diretamente `public/sample.csv` no seletor.
3. O mapeamento deve reconhecer automaticamente as cinco colunas.
4. Clique em **Abrir dashboard**.

## Como carregar seus dados

1. Exporte ou consolide seu histórico em um arquivo `.csv` ou `.parquet`.
2. Arraste o arquivo para a área indicada ou clique nela.
3. O DuckDB lê somente o schema primeiro.
4. Revise o mapeamento detectado e corrija qualquer campo necessário.
5. Clique em **Abrir dashboard**. A limpeza/materialização pode levar alguns instantes em arquivos grandes.

O CSV deve possuir cabeçalho. Codificação UTF-8 é recomendada. `read_csv_auto` detecta delimitador e aspas automaticamente e amostra até 200 mil linhas para inferir a estrutura; os valores são lidos inicialmente como texto para tornar o mapeamento mais robusto.

## Mapeamento de colunas

Campos obrigatórios:

| Campo interno | Nomes reconhecidos automaticamente |
|---|---|
| Data/hora | `ts`, `timestamp`, `played_at`, `datetime`, `date`, `endtime` |
| Artista | `master_metadata_album_artist_name`, `artist`, `artist_name`, `album_artist` |
| Música | `master_metadata_track_name`, `track`, `track_name`, `song`, `title` |

Campos opcionais:

| Campo interno | Nomes reconhecidos automaticamente |
|---|---|
| Álbum | `master_metadata_album_album_name`, `album`, `album_name` |
| Duração em milissegundos | `ms_played`, `duration`, `duration_ms`, `milliseconds_played`, `played_ms` |

A coluna genérica `duration` é interpretada como **milissegundos**. Se seu arquivo armazena segundos, converta para milissegundos antes de carregar.

Sem álbum, o app usa “Sem álbum”. Sem duração, cada linha válida conta como uma reprodução, o filtro mínimo é desativado e os indicadores de tempo ficam indisponíveis. O app não inventa uma duração média.

### Limpeza aplicada

- Conversão tolerante da data/hora para `TIMESTAMP`.
- Remoção de linhas com data inválida, artista vazio ou música vazia.
- Duração inválida vira zero; duração negativa é limitada a zero.
- Remoção de duplicatas exatas pelo conjunto data/hora + artista + música + álbum + duração.
- Aplicação do mínimo de duração durante as consultas, não na importação; assim ele pode ser alterado sem recarregar o arquivo.

## Filtros e comparação

Todos os gráficos usam o mesmo intervalo, artista, álbum, ano/mês e duração mínima. “Último mês”, “Últimos 3 meses”, “Este ano” e “Ano passado” usam como referência a **data mais recente disponível no arquivo**, o que também torna históricos antigos fáceis de testar.

Cada percentual de KPI compara o período selecionado com o intervalo imediatamente anterior de igual quantidade de dias. Filtros de artista, álbum e duração permanecem iguais na comparação.

A descoberta considera a primeira aparição do artista no histórico completo compatível com os filtros de artista/álbum/duração, e então verifica se essa primeira data caiu no período selecionado.

## Gerar a Cápsula Sonora

1. Ajuste os filtros globais para o período desejado.
2. Clique em **Gerar Cápsula** no cabeçalho.
3. Confira a prévia.
4. Opcionalmente escolha uma imagem de capa; ela é lida localmente. Sem imagem, o app usa arte procedural com a paleta do projeto.
5. Clique em **Baixar PNG** ou **Copiar imagem**.

A exportação usa um cartão de 540 × 960 CSS pixels com `pixelRatio: 2`, resultando em **1080 × 1920 px**. A cópia depende da permissão de clipboard do navegador e de contexto seguro (`localhost` é aceito); o download continua disponível como alternativa.

## Paleta e personalização

Os tokens estão em `tailwind.config.js` e as variáveis CSS em `src/index.css`:

| Token | Cor |
|---|---|
| `carbon` / `--carbon-black` | `#171717` |
| `graphite` / `--graphite` | `#2D2D30` |
| `slime` / `--slime-lime` | `#A3E635` |
| `petal` / `--petal-pink` | `#D162A4` |
| `banana` / `--banana-cream` | `#FAEE66` |

Para mudar espaçamentos e componentes reutilizáveis, edite a camada `@layer components` em `src/index.css`. As cores dos gráficos ficam em `src/lib/chartTheme.ts`. A arte procedural está em `src/components/capsule/ProceduralCover.tsx`.

## Estrutura principal

```text
src/
├── components/
│   ├── capsule/       # cartão, modal e exportação
│   ├── charts/        # gráficos e heatmaps
│   ├── dashboard/     # cabeçalho, KPIs, rankings
│   └── filters/       # filtros globais
├── hooks/             # consulta e debounce
├── lib/
│   ├── duckdb.ts      # ingestão, normalização e SQL
│   ├── format.ts      # pt-BR e duração
│   └── columnDetection.ts
├── store/             # Zustand
└── types/             # contratos TypeScript
```

## Decisões e limites conhecidos

- O arquivo é processado em memória pelo navegador. Para históricos excepcionalmente grandes, feche abas pesadas e prefira Parquet.
- Os campos de artista e álbum sugerem os 500 itens com mais reproduções para manter a interface leve, mas aceitam qualquer valor digitado; rankings e métricas consultam todo o arquivo.
- O bump chart usa os cinco artistas líderes do período e mostra a posição real deles entre todos os artistas em cada agrupamento.
- O acumulado é agregado por mês para manter o gráfico fluido em históricos longos.
- A sequência considera dias civis consecutivos no timestamp já interpretado pelo DuckDB. Timestamps com fuso (`Z`/offset) são aceitos; o app não tenta adivinhar ou substituir o fuso original.

## Scripts

- `npm run dev` — desenvolvimento
- `npm run typecheck` — TypeScript
- `npm run build` — build de produção
- `npm run preview` — prévia do build
