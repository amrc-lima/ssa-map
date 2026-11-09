# Plano do Projeto — Mapa Eleitoral de Salvador 2024

## 1. Objetivo

Construir uma ferramenta web pública e gratuita que mostre, sobre o mapa de Salvador, o desempenho eleitoral de 2024 (prefeito e vereador) por área geográfica, com coloração por partido/candidato e intensidade proporcional à votação. Deve usar fontes oficiais do TSE e a base cartográfica oficial dos bairros, com total automação da coleta e atualização dos dados.

### Requisitos funcionais (destilados de `proj.md` e `election-data.md`)

- RF1. Exibir o mapa de Salvador colorido por área (bairro, zona eleitoral, local de votação e, quando possível, seção).
- RF2. Cor da área = partido/candidato vencedor (ou o candidato/partido selecionado).
- RF3. Intensidade da cor em dois modos:
  - Modo A (global): `votos(area,cand) / maxVotosGlobal`, onde `maxVotosGlobal` é o maior nº de votos que **qualquer** candidato recebeu em **uma única** área.
  - Modo B (autorelativa): `votos(area,cand) / maxVotosDoCandidato`, onde o denominador é o máximo do próprio candidato entre as áreas.
- RF4. Área com 0 voto recebe hachura diagonal (não branco vazio).
- RF5. Selecionar cargo, candidato e partido.
- RF6. Fotos oficiais dos candidatos (via `sqcand`), sem download/organização manual.
- RF7. Navegar entre níveis geográficos e ver totais (comparecimento, abstenção, brancos, nulos).
- RF8. Explicitar visualmente quando a atribuição de votos a um bairro é aproximada.
- RF9. 100% gratuito para usuários e para o mantenedor.

---

## 2. Decisões de arquitetura

### 2.1 Princípio central: ETL pré-computado + site estático

Toda a coleta e o cruzamento de dados acontecem em um **pipeline ETL** executado fora do navegador. O resultado são **artefatos estáticos** (JSON/GeoJSON) servidos por CDN. Não há servidor de aplicação, banco de dados online nem custo de infraestrutura. Isso atende ao requisito de custo zero e simplifica segurança e cache.

```
Fontes oficiais (TSE, Prefeitura)
        │
        ▼
┌─────────────────────────────────────────────┐
│ ETL Python (execução agendada ou manual)     │
│  1. Coleta (requests + cache + retry)        │
│  2. Validação de schema                      │
│  3. Geoespacial (geopandas)                  │
│  4. Agregação seção → local → bairro/zona    │
│  5. Pré-cálculo de totais e máximos          │
│  6. Exportação de artefatos estáticos        │
└─────────────────────────────────────────────┘
        │
        ▼
Artefatos estáticos (data/ e geo/)
        │
        ▼
┌─────────────────────────────────────────────┐
│ Site estático (Vite + React + MapLibre GL)   │
│  choropleth · hachura · legenda · seletores  │
└─────────────────────────────────────────────┘
        │
        ▼
Deploy gratuito (Cloudflare Pages / GitHub Pages)
```

### 2.2 Stack escolhida

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Coleta/ETL | **Python 3.13** + `requests`, `pandas`, `geopandas`, `shapely`, `pyproj`, `pydantic` | Melhor ecossistema geospacial e de dados; já instalado no ambiente. |
| Formato geo | **GeoJSON** (bairros/locais) + **PMTiles** opcional para camadas grandes | GeoJSON é simples e versionável; PMTiles reduz banda se as seções forem numerosas. |
| Frontend | **Vite + React + TypeScript** | Build rápido, tipagem, ecossistema. |
| Mapa | **MapLibre GL JS** | Open source, sem chave de API, vetorial, bom desempenho e suporte a padrões/hachura. |
| Estilo | **Tailwind CSS** | UI rápida e consistente. |
| Deploy | **Cloudflare Pages** (principal) / GitHub Pages (alternativa) | Gratuito, CDN global, HTTPS. |
| Automação | **GitHub Actions** (cron + deploy) | Gratuito para repositórios públicos. |
| Testes | `pytest` (ETL) + `vitest` (frontend) | Verificação de transformações e funções de cor. |

### 2.3 Por que não backend em tempo real

- Os dados eleitorais não mudam após a apuração; não há necessidade de consulta dinâmica.
- Evita custos, rate limits e indisponibilidade do TSE em produção.
- Permite publicar snapshots auditáveis e reproduzíveis (importante para dados eleitorais).

---

## 3. Fontes de dados

### 3.1 Candidaturas — DivulgaCandContas (TSE)

- Base: `https://divulgacandcontas.tse.jus.br/divulga/rest/v1`
- Obter para Salvador (código IBGE `2927408`), 2024: `nome`, `nomeUrna`, `numero`, `partido`, `cargo`, `situação`, `sqcand`.
- Fotos: montadas a partir de `sqcand` conforme a estrutura de diretórios do TSE.
- **A validar na Fase 0:** formato exato das rotas, paginação, códigos de cargo/turno e padrão de URL das fotos (a documentação citada é não oficial).

### 3.2 Resultados — TSE

- Base: `https://resultados.tse.jus.br/oficial/`
- Necessário: votação nominal por candidato, por seção/zona; comparecimento, abstenção, brancos e nulos.
- **A validar na Fase 0:** sufixo eleitoral (código da eleição 2024), caminhos por UF/município, encoding e granularidade dos arquivos.

### 3.3 Locais de votação e geografia

- Locais de votação com endereço e, quando disponível, coordenadas oficiais.
- Base cartográfica:
  - `mapas/mapa1/BA_bairros_CD2022.gpkg` — 468 bairros de 11 municípios da BA, SRS 4674 (SIRGAS 2000); **173 bairros de Salvador**, com `CD_MUN=2927408`.
  - Serviço ArcGIS da Prefeitura `Bairros_Dec32791_20_Vigente` (layer 0, SRS 3857), consultável em GeoJSON.
- **Decisão:** usar o serviço ArcGIS "vigente" como base principal de exibição (mais atual e oficial da Prefeitura) e o GPKG como base de validação/fallback e para conferência de nomes.

### 3.4 Modelo de incerteza (crítico)

Seção eleitoral **não** é bairro. O voto é registrado na seção, cujo local de votação pode atender eleitores de vários bairros. Portanto:

- A unidade geográfica mais fiel é o **local de votação** (ponto).
- A agregação para **bairro** é feita por *spatial join* do ponto do local → polígono do bairro, e é uma **aproximação**, sinalizada na UI.
- Zonas eleitorais são exibidas como agregação administrativa.
- A UI deve indicar cobertura: quantas seções locais foram geocodificadas e qual o percentual de votos atribuído com precisão.

---

## 4. Estrutura do repositório

```
ssa-map/
├── plano.md                     # este documento
├── data-pipeline/
│   ├── pyproject.toml
│   ├── src/ssa_etl/
│   │   ├── cli.py               # orquestra o pipeline
│   │   ├── config.py            # constantes (mun. 2927408, ano, URLs)
│   │   ├── cache.py             # cache HTTP em disco + retry
│   │   ├── sources/
│   │   │   ├── tse_candidaturas.py
│   │   │   ├── tse_resultados.py
│   │   │   ├── tse_locais.py
│   │   │   └── bairros.py       # ArcGIS + GPKG
│   │   ├── transform/
│   │   │   ├── normalize.py     # normalização de nomes/partidos/cargos
│   │   │   ├── geo.py           # projeção, spatial join, geocodificação
│   │   │   └── aggregate.py     # seção → local → bairro/zona
│   │   ├── export/
│   │   │   └── artifacts.py     # grava data/ e geo/
│   │   └── models.py            # pydantic (validação de schema)
│   ├── tests/
│   └── cache/                   # respostas HTTP (gitignored)
├── web/
│   ├── package.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── map/
│   │   │   ├── MapView.tsx
│   │   │   ├── layers/bairros.ts
│   │   │   ├── layers/locais.ts
│   │   │   └── patterns/hatch.ts
│   │   ├── components/
│   │   │   ├── CandidatePicker.tsx
│   │   │   ├── PartyPicker.tsx
│   │   │   ├── LevelToggle.tsx
│   │   │   ├── ModeToggle.tsx
│   │   │   ├── Legend.tsx
│   │   │   └── DataNotice.tsx   # aviso de incerteza/cobertura
│   │   ├── lib/
│   │   │   ├── color.ts         # escalas e interpolação
│   │   │   └── metrics.ts       # modos A e B, vencedores
│   │   └── state/
│   │       └── filters.ts
│   └── public/data/             # artefatos gerados (podem ser symlink/cópia)
├── .github/workflows/
│   ├── etl.yml                  # cron: coleta + gera artefatos + commit
│   └── deploy.yml               # publica web/ no Pages
└── README.md                    # uso, fontes, licença
```

---

## 5. Modelo de dados (artefatos)

### 5.1 `data/partidos.json`

```json
{
  "13": { "sigla": "PT", "nome": "Partido dos Trabalhadores", "cor": "#c8102e" }
}
```

A cor do partido é definida por uma tabela curada (não automática), com fallback determinístico por hash da sigla.

### 5.2 `data/candidatos.json`

```json
[
  {
    "sqcand": "250000000000",
    "nome": "Fulano de Tal",
    "nomeUrna": "FULANO",
    "numero": "13",
    "cargo": "vereador",
    "partido": { "numero": 13, "sigla": "PT" },
    "situacao": "APTO",
    "fotoUrl": "https://divulgacandcontas.tse.jus.br/.../fulano.jpeg"
  }
]
```

### 5.3 `data/resultados.json` (por nível)

Arquivo por nível (`bairro`, `zona`, `local`, `secao`) para manter payloads pequenos:

```json
{
  "nivel": "bairro",
  "cargo": "vereador",
  "geradoEm": "2026-11-09T00:00:00Z",
  "totais": { "comparecimento": 0, "abstencao": 0, "brancos": 0, "nulos": 0 },
  "areas": {
    "BAIRRO_ID": {
      "nome": "Barra",
      "eleitores": 12345,
      "comparecimento": 10000,
      "abstencao": 2345,
      "brancos": 100,
      "nulos": 200,
      "votos": { "SQCAND_1": 3000, "SQCAND_2": 1500 }
    }
  },
  "maximos": {
    "global": 20000,
    "porCandidato": { "SQCAND_1": 3000, "SQCAND_2": 2500 }
  },
  "cobertura": {
    "secoesTotal": 0,
    "secoesGeocodificadas": 0,
    "votosAtribuidosComPrecisao": 0.0
  }
}
```

### 5.4 `geo/bairros.geojson`

- Polígonos de Salvador em WGS84 (EPSG:4326), com propriedades `id`, `nome`, `cd_mun`.
- Gerado a partir do serviço ArcGIS; conferido contra o GPKG (173 bairros de Salvador).

### 5.5 `geo/locais.geojson`

- Pontos dos locais de votação com `id`, `nome`, `endereco`, `zona`, `bairro_atribuido`.

---

## 6. Pipeline ETL (etapas)

### Fase 0 — Validação das fontes (obrigatória antes de codar)

1. Executar chamadas de teste aos endpoints do TSE e registrar: status, formato, campos, paginação, limites.
2. Confirmar o padrão real de URL das fotos a partir de `sqcand`.
3. Baixar amostra de resultados de Salvador e mapear a estrutura.
4. Documentar tudo em `docs/fontes-tse.md` (resultado real, não suposição).

### Fase 1 — Coleta

- Cliente HTTP com:
  - cache em disco por URL + hash (evita rebaixar arquivos grandes);
  - backoff exponencial e timeout;
  - User-Agent identificável e respeito ao rate limit.
- Download de candidaturas, resultados e locais de votação.

### Fase 2 — Normalização

- Padronizar nomes de candidatos/partidos (`strip`, acentos, caixa).
- Mapear códigos de cargo e situação.
- Validação com `pydantic`; falha explícita se o schema mudar.

### Fase 3 — Geoespacial

1. Reprojetar tudo para WGS84 (EPSG:4326) para o frontend.
2. `spatial join` dos locais de votação (pontos) → bairros (polígonos).
3. Para locais sem coordenada: geocodificação em lote (Nominatim, com cache e respeito ao uso) ou descarte sinalizado.
4. Validar: nenhum ponto fora de Salvador; nenhum polígono sem nome; cobertura mínima aceitável.

### Fase 4 — Agregação

- `secao → local → bairro` e `secao → zona`.
- Somar votos nominais por candidato, além de brancos, nulos, comparecimento e abstenção.
- Guardar a proveniência: quais seções entraram em cada área e quais foram descartadas.

### Fase 5 — Pré-cálculo das métricas

- `maximos.global`: maior votação de qualquer candidato em qualquer área.
- `maximos.porCandidato`: maior votação de cada candidato entre as áreas.
- Vencedor por área (para a visão "resultado").
- Métricas de cobertura/incerteza.

### Fase 6 — Exportação

- Gravar `data/*.json` e `geo/*.geojson` (opcionalmente PMTiles).
- Gerar manifest com `geradoEm`, hash dos dados e contagem de registros.
- Falhar o build se validações de integridade não passarem.

---

## 7. Frontend e visualização

### 7.1 Camadas

- `bairros` (polígonos) — camada principal.
- `zonas` (polígonos agregados) — visão administrativa.
- `locais` (pontos) — visão mais fiel.
- Hachura como `fill-pattern` para áreas com 0 voto.

### 7.2 Modos de cor

Função de intensidade `t ∈ [0,1]`:

- Modo A (global): `t = votos(area,cand) / maxGlobal`
- Modo B (autorelativa): `t = votos(area,cand) / maxDoCandidato`

Cor final: interpolar do fundo neutro até a cor do partido em `t` (ex.: HSL/OKLCH com lightness variável). `t = 0` → hachura diagonal.

Visões de interação:

1. **Resultado por área** (vencedor): cor do partido vencedor; intensidade pelo modo escolhido.
2. **Candidato/partido focado**: cor única do partido; intensidade pelo modo escolhido.

### 7.3 Controles

- Seletor de cargo (prefeito / vereador).
- Seletor de candidato e de partido.
- Alternância de nível geográfico (bairro / zona / local / seção).
- Alternância de modo (A / B).
- Legenda dinâmica com escala e valor máximo.
- Painel de detalhes da área (tooltip/popup): votos, %, brancos, nulos, comparecimento, abstenção.
- Aviso de cobertura/incerteza (`DataNotice`).

### 7.4 Desempenho

- Carregar GeoJSON no build e manter em memória.
- Se seções forem muitas, usar PMTiles/vector tiles.
- Recalcular cor no cliente a partir de `maximos` pré-calculados (sem busca extra).
- Debounce em filtros e virtualização de listas de candidatos.

---

## 8. Automação e deploy

### 8.1 GitHub Actions

- `etl.yml` (cron semanal + manual): executa o pipeline, valida, gera artefatos e comita em `web/public/data` ou publica em branch de dados.
- `deploy.yml`: build do `web/` e publicação no Cloudflare Pages/GitHub Pages.
- Cache de dependências e dos downloads do TSE entre execuções.

### 8.2 Custo

- Cloudflare Pages / GitHub Pages: gratuito.
- GitHub Actions: gratuito em repositório público.
- Sem backend, sem banco, sem chaves pagas. Atende ao RF9.

---

## 9. Qualidade, testes e transparência

- **ETL:** testes de parsing de amostras reais, do spatial join (casos de fronteira) e da agregação (somas fecham com o total do TSE).
- **Frontend:** testes de `color.ts`, `metrics.ts` (modos A/B), seleção de vencedor.
- **Integridade:** asserções de contagem (ex.: 173 bairros de Salvador), soma de votos por área = total do local, cobertura mínima.
- **Transparência:** página "Sobre os dados" com fontes, data de geração, metodologia de atribuição e limitações; rodapé com aviso de que a distribuição por bairro é aproximada.

---

## 10. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| APIs do TSE mudarem ou ficarem indisponíveis | Alto | Fase 0 valida; cache em disco; falha explícita e snapshot versionado. |
| Seção ≠ bairro | Alto (correção do dado) | Exibir local de votação como nível fiel; rotular bairro como aproximação; mostrar cobertura. |
| Locais sem coordenadas | Médio | Geocodificação em lote com cache; marcar não atribuídos. |
| Base de bairros divergente (GPKG vs ArcGIS) | Médio | ArcGIS como principal; validar nomes/contagem contra GPKG. |
| Payload grande de seções | Médio | PMTiles/vector tiles; agregação por nível. |
| Rate limit / uso do Nominatim | Baixo/Médio | Cache, lote, User-Agent e limites; preferir coordenadas oficiais do TSE. |
| Fotos indisponíveis | Baixo | Placeholder e carregamento preguiçoso. |

---

## 11. Roadmap

- [ ] **Fase 0 — Descoberta:** testar e documentar endpoints reais do TSE; validar fotos; mapear formato dos resultados.
- [ ] **Fase 1 — Base cartográfica:** baixar bairros do ArcGIS (GeoJSON 4326); validar 173 bairros; comparar com o GPKG.
- [ ] **Fase 2 — ETL de candidaturas:** coletar e normalizar candidatos de Salvador 2024.
- [ ] **Fase 3 — ETL de resultados + locais:** coletar, geocodificar e agregar.
- [ ] **Fase 4 — Artefatos:** gerar `candidatos.json`, `resultados_{nivel}.json`, `bairros.geojson`, `locais.geojson`, manifest.
- [ ] **Fase 5 — Mapa MVP:** choropleth por bairro com vencedor, legenda e tooltip.
- [ ] **Fase 6 — Modos de cor:** modos A e B, hachura para zero, foco em candidato/partido.
- [ ] **Fase 7 — Níveis:** alternância bairro/zona/local/seção e painel de incerteza.
- [ ] **Fase 8 — Fotos e partidos:** cores curadas e fotos via `sqcand`.
- [ ] **Fase 9 — Automação e deploy:** Actions (cron + deploy), Cloudflare Pages, página "Sobre os dados".
- [ ] **Fase 10 — QA e lançamento:** testes, acessibilidade, performance, revisão de dados.

---

## 12. Critérios de aceite

- Mapa renderiza os 173 bairros de Salvador com nomes corretos.
- As duas normalizações (A e B) produzem resultados coerentes e reproduzíveis.
- Áreas com 0 voto exibem hachura.
- Soma dos votos por área bate com os totais oficiais do TSE (tolerância zero para o que foi atribuído).
- A UI informa claramente cobertura e limitações da atribuição por bairro.
- Pipeline roda de ponta a ponta via `python -m ssa_etl` e via GitHub Actions.
- Deploy público, gratuito e acessível por URL.

---

## 13. Próximo passo imediato

Executar a **Fase 0**: sondar e documentar os endpoints reais do TSE (candidaturas, resultados, locais e fotos) e validar a base de bairros. Sem essa validação, qualquer implementação parte de suposições — o que o próprio `election-data.md` proíbe.
