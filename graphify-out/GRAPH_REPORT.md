# Graph Report - ssa-map  (2026-11-10)

## Corpus Check
- 92 files · ~160,659 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 135 file(s) not represented in the graph (top: .css 95, .htm 36, (none) 2)

## Summary
- 361 nodes · 483 edges · 53 communities (13 shown, 40 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `31cd4602`
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
- Cache
- Fontes de dados oficiais — Fase 0 (validado)
- App.backup.tsx
- .oxlintrc.json
- React + TypeScript + Vite
- tsconfig.json
- AGENTS.md
- ssa-etl

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `App()` - 15 edges
3. `compilerOptions` - 15 edges
4. `App()` - 14 edges
5. `Plano do Projeto — Mapa Eleitoral de Salvador 2024` - 14 edges
6. `build()` - 13 edges
7. `Cache` - 11 edges
8. `load_locais()` - 9 edges
9. `6. Pipeline ETL (etapas)` - 8 edges
10. `steps` - 7 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `build()`  [EXTRACTED]
  data-pipeline/src/ssa_etl/cli.py → data-pipeline/src/ssa_etl/build.py
- `download()` --calls--> `Cache`  [EXTRACTED]
  data-pipeline/src/ssa_etl/sources/tse.py → data-pipeline/src/ssa_etl/cache.py
- `App()` --calls--> `SearchSelect()`  [EXTRACTED]
  web/src/App.backup.tsx → web/src/SearchSelect.tsx
- `App()` --calls--> `partyColor()`  [EXTRACTED]
  web/src/App.tsx → web/src/partyColors.ts
- `find()` --calls--> `csv_files()`  [EXTRACTED]
  data-pipeline/scripts/explore_salvador.py → data-pipeline/src/ssa_etl/sources/tse.py

## Import Cycles
- None detected.

## Communities (53 total, 40 thin omitted)

### Community 0 - "Plano do Projeto — Mapa Eleitoral de Salvador 2024"
Cohesion: 0.05
Nodes (40): 10. Riscos e mitigações, 11. Roadmap, 12. Critérios de aceite, 13. Próximo passo imediato, 1. Objetivo, 2.1 Princípio central: ETL pré-computado + site estático, 2.2 Stack escolhida, 2.3 Por que não backend em tempo real (+32 more)

### Community 1 - "package.json"
Cohesion: 0.08
Nodes (31): maplibre-gl, oxlint, react, react-dom, @types/node, @types/react, @types/react-dom, typescript (+23 more)

### Community 2 - "geo.py"
Cohesion: 0.08
Nodes (19): norm(), norm(), find(), _agremiacoes(), build(), _federacao_sigla(), _fmt_int(), _load_votacao() (+11 more)

### Community 3 - "steps"
Cohesion: 0.08
Nodes (23): runs-on, steps, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, jobs, deploy, name, on (+15 more)

### Community 4 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 5 - "pathlib"
Cohesion: 0.25
Nodes (4): unescape_all(), unescape_all(), clean(), show()

### Community 6 - "App.tsx"
Cohesion: 0.08
Nodes (35): App(), Avatar(), BairroCollection, BairroFeature, BairroMeta, CampeaoAba, CampeaoCargo, Candidato (+27 more)

### Community 7 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 8 - "Cache"
Cohesion: 0.22
Nodes (3): Cache, main(), fetch_bairros()

### Community 9 - "Fontes de dados oficiais — Fase 0 (validado)"
Cohesion: 0.25
Nodes (7): Endpoints validados, Fontes de dados oficiais — Fase 0 (validado), Formato dos CSVs, Implicações de arquitetura, Recursos confirmados (2024), Resumo, Ruff/qualidade

### Community 10 - "App.backup.tsx"
Cohesion: 0.09
Nodes (32): App(), Avatar(), BairroCollection, BairroFeature, BairroMeta, Candidato, CandidatosDoc, Cargo (+24 more)

### Community 11 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 13 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **1 isolated node(s):** `ssa-etl`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 196 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `package.json` to `App.backup.tsx`, `App.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `ssa-etl` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Plano do Projeto — Mapa Eleitoral de Salvador 2024` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Why does `maplibre-gl` connect `package.json` to `App.backup.tsx`, `App.tsx`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0773109243697479 - nodes in this community are weakly interconnected._
- **Should `geo.py` be split into smaller, more focused modules?**
  _Cohesion score 0.07743496672716274 - nodes in this community are weakly interconnected._
- **Should `steps` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._