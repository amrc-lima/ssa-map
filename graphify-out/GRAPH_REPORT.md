# Graph Report - ssa-map  (2026-11-09)

## Corpus Check
- 39 files · ~16,560 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: .htm 4, (none) 2, .css 2)

## Summary
- 242 nodes · 319 edges · 23 communities (12 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `93cffd35`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Plano do Projeto — Mapa Eleitoral de Salvador 2024
- package.json
- geo.py
- steps
- compilerOptions
- tse.py
- App.tsx
- compilerOptions
- Cache
- Fontes de dados oficiais — Fase 0 (validado)
- cli.py
- .oxlintrc.json
- 3. Fontes de dados
- React + TypeScript + Vite
- tsconfig.json
- AGENTS.md
- ssa-etl

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `compilerOptions` - 15 edges
3. `Plano do Projeto — Mapa Eleitoral de Salvador 2024` - 14 edges
4. `Cache` - 11 edges
5. `build()` - 10 edges
6. `load_locais()` - 9 edges
7. `6. Pipeline ETL (etapas)` - 8 edges
8. `steps` - 7 edges
9. `csv_files()` - 7 edges
10. `Fontes de dados oficiais — Fase 0 (validado)` - 7 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `build()`  [EXTRACTED]
  data-pipeline/src/ssa_etl/cli.py → data-pipeline/src/ssa_etl/build.py
- `fetch_bairros()` --calls--> `Cache`  [EXTRACTED]
  data-pipeline/src/ssa_etl/sources/bairros.py → data-pipeline/src/ssa_etl/cache.py
- `download()` --calls--> `Cache`  [EXTRACTED]
  data-pipeline/src/ssa_etl/sources/tse.py → data-pipeline/src/ssa_etl/cache.py
- `load_locais()` --calls--> `csv_files()`  [EXTRACTED]
  data-pipeline/src/ssa_etl/geo.py → data-pipeline/src/ssa_etl/sources/tse.py
- `load_candidatos()` --calls--> `csv_files()`  [EXTRACTED]
  data-pipeline/src/ssa_etl/geo.py → data-pipeline/src/ssa_etl/sources/tse.py

## Import Cycles
- None detected.

## Communities (23 total, 11 thin omitted)

### Community 0 - "Plano do Projeto — Mapa Eleitoral de Salvador 2024"
Cohesion: 0.06
Nodes (35): 10. Riscos e mitigações, 11. Roadmap, 12. Critérios de aceite, 13. Próximo passo imediato, 1. Objetivo, 2.1 Princípio central: ETL pré-computado + site estático, 2.2 Stack escolhida, 2.3 Por que não backend em tempo real (+27 more)

### Community 1 - "package.json"
Cohesion: 0.09
Nodes (29): maplibre-gl, oxlint, react-dom, @types/node, @types/react, @types/react-dom, typescript, vite (+21 more)

### Community 2 - "geo.py"
Cohesion: 0.19
Nodes (10): norm(), norm(), build(), _load_votacao(), party_color(), _write(), load_bairros(), load_candidatos() (+2 more)

### Community 3 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, jobs, deploy, name, on (+15 more)

### Community 4 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 5 - "tse.py"
Cohesion: 0.19
Nodes (4): find(), csv_files(), download(), extract()

### Community 6 - "App.tsx"
Cohesion: 0.13
Nodes (16): react, react@^19.3.1, App(), BairroCollection, BairroFeature, BairroMeta, Candidato, CandidatosDoc (+8 more)

### Community 7 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 9 - "Fontes de dados oficiais — Fase 0 (validado)"
Cohesion: 0.25
Nodes (7): Endpoints validados, Fontes de dados oficiais — Fase 0 (validado), Formato dos CSVs, Implicações de arquitetura, Recursos confirmados (2024), Resumo, Ruff/qualidade

### Community 11 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 12 - "3. Fontes de dados"
Cohesion: 0.40
Nodes (5): 3.1 Candidaturas — DivulgaCandContas (TSE), 3.2 Resultados — TSE, 3.3 Locais de votação e geografia, 3.4 Modelo de incerteza (crítico), 3. Fontes de dados

### Community 13 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **1 isolated node(s):** `ssa-etl`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 138 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Plano do Projeto — Mapa Eleitoral de Salvador 2024` connect `Plano do Projeto — Mapa Eleitoral de Salvador 2024` to `3. Fontes de dados`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `ssa-etl` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Plano do Projeto — Mapa Eleitoral de Salvador 2024` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Why does `Cache` connect `Cache` to `cli.py`, `tse.py`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08602150537634409 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.tsx` to `package.json`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `steps` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._