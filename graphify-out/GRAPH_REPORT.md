# Graph Report - ssa-map  (2026-11-10)

## Corpus Check
- 91 files · ~156,499 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 135 file(s) not represented in the graph (top: .css 95, .htm 36, (none) 2)

## Summary
- 331 nodes · 431 edges · 54 communities (13 shown, 41 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3cf710e3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Plano do Projeto — Mapa Eleitoral de Salvador 2024
- package.json
- geo.py
- steps
- compilerOptions
- pathlib
- App.tsx
- compilerOptions
- build.py
- Fontes de dados oficiais — Fase 0 (validado)
- Cache
- .oxlintrc.json
- React + TypeScript + Vite
- tsconfig.json
- AGENTS.md
- ssa-etl
- 6. Pipeline ETL (etapas)

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `App()` - 15 edges
3. `compilerOptions` - 15 edges
4. `Plano do Projeto — Mapa Eleitoral de Salvador 2024` - 14 edges
5. `build()` - 13 edges
6. `Cache` - 11 edges
7. `load_locais()` - 9 edges
8. `6. Pipeline ETL (etapas)` - 8 edges
9. `steps` - 7 edges
10. `csv_files()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `fetch_bairros()` --calls--> `Cache`  [EXTRACTED]
  data-pipeline/src/ssa_etl/sources/bairros.py → data-pipeline/src/ssa_etl/cache.py
- `download()` --calls--> `Cache`  [EXTRACTED]
  data-pipeline/src/ssa_etl/sources/tse.py → data-pipeline/src/ssa_etl/cache.py
- `load_locais()` --calls--> `csv_files()`  [EXTRACTED]
  data-pipeline/src/ssa_etl/geo.py → data-pipeline/src/ssa_etl/sources/tse.py
- `load_candidatos()` --calls--> `csv_files()`  [EXTRACTED]
  data-pipeline/src/ssa_etl/geo.py → data-pipeline/src/ssa_etl/sources/tse.py
- `find()` --calls--> `csv_files()`  [EXTRACTED]
  data-pipeline/scripts/explore_salvador.py → data-pipeline/src/ssa_etl/sources/tse.py

## Import Cycles
- None detected.

## Communities (54 total, 41 thin omitted)

### Community 0 - "Plano do Projeto — Mapa Eleitoral de Salvador 2024"
Cohesion: 0.06
Nodes (32): 10. Riscos e mitigações, 11. Roadmap, 12. Critérios de aceite, 13. Próximo passo imediato, 1. Objetivo, 2.1 Princípio central: ETL pré-computado + site estático, 2.2 Stack escolhida, 2.3 Por que não backend em tempo real (+24 more)

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (29): maplibre-gl, oxlint, react-dom, @types/node, @types/react, @types/react-dom, typescript, vite (+21 more)

### Community 2 - "geo.py"
Cohesion: 0.14
Nodes (7): norm(), norm(), find(), norm(), csv_files(), download(), extract()

### Community 3 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, jobs, deploy, name, on (+15 more)

### Community 4 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 5 - "pathlib"
Cohesion: 0.18
Nodes (4): unescape_all(), unescape_all(), clean(), show()

### Community 6 - "App.tsx"
Cohesion: 0.07
Nodes (40): react, react@^19.3.1, App(), Avatar(), BairroCollection, BairroFeature, BairroMeta, CampeaoAba (+32 more)

### Community 7 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 8 - "build.py"
Cohesion: 0.12
Nodes (14): _agremiacoes(), build(), _federacao_sigla(), _fmt_int(), _load_votacao(), party_color(), _quociente_eleitoral(), _status_candidato() (+6 more)

### Community 9 - "Fontes de dados oficiais — Fase 0 (validado)"
Cohesion: 0.25
Nodes (7): Endpoints validados, Fontes de dados oficiais — Fase 0 (validado), Formato dos CSVs, Implicações de arquitetura, Recursos confirmados (2024), Resumo, Ruff/qualidade

### Community 11 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 13 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 53 - "6. Pipeline ETL (etapas)"
Cohesion: 0.25
Nodes (8): 6. Pipeline ETL (etapas), Fase 0 — Validação das fontes (obrigatória antes de codar), Fase 1 — Coleta, Fase 2 — Normalização, Fase 3 — Geoespacial, Fase 4 — Agregação, Fase 5 — Pré-cálculo das métricas, Fase 6 — Exportação

## Knowledge Gaps
- **1 isolated node(s):** `ssa-etl`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 180 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Plano do Projeto — Mapa Eleitoral de Salvador 2024` connect `Plano do Projeto — Mapa Eleitoral de Salvador 2024` to `6. Pipeline ETL (etapas)`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `ssa-etl` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Plano do Projeto — Mapa Eleitoral de Salvador 2024` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.tsx` to `package.json`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08602150537634409 - nodes in this community are weakly interconnected._
- **Why does `Cache` connect `Cache` to `build.py`, `geo.py`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `geo.py` be split into smaller, more focused modules?**
  _Cohesion score 0.1425287356321839 - nodes in this community are weakly interconnected._