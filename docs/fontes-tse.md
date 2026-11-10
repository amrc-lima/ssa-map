# Fontes de dados oficiais — Fase 0 (validado)

Data da sondagem: 2026-11-09.

## Resumo

| Item | Resultado |
|---|---|
| DivulgaCandContas REST | **Bloqueado por WAF Akamai** (403 `Access Denied`) a partir do nosso ambiente/IP. API pública, mas não confiável para ETL automatizado. |
| Portal de Dados Abertos do TSE | **200 OK**. Fonte principal adotada (`dadosabertos.tse.jus.br` + `cdn.tse.jus.br`). |
| Fotos de candidatos | Disponíveis em **lote por UF** (`foto_cand2024_BA_div.zip`, ~1,08 GB). |
| Locais de votação com coordenadas | **Sim** — `eleitorado_local_votacao_2024.zip` traz `NR_LATITUDE`, `NR_LONGITUDE`, `NM_BAIRRO`, endereço, zona, seção e eleitores. |
| Base cartográfica | ArcGIS da Prefeitura (`Bairros_Dec32791_20_Vigente`) responde 200 e tem **170 bairros** na camada vigente; GPKG local tem 173 bairros de Salvador (EPSG:4674). O app usa a camada vigente. |

## Endpoints validados

- CKAN API: `https://dadosabertos.tse.jus.br/api/3/action`
  - `package_search?q=...`, `package_show?id=...`
- CDN: `https://cdn.tse.jus.br/estatistica/sead/...`
- Eleição 2024: id `2045202024`; 1º turno; pleito `619`.

## Recursos confirmados (2024)

| Recurso | URL | Tamanho |
|---|---|---|
| Candidatos | `.../odsele/consulta_cand/consulta_cand_2024.zip` | 64,7 MB |
| Candidatos (complementar) | `.../odsele/consulta_cand_complementar/consulta_cand_complementar_2024.zip` | — |
| Redes sociais | `.../odsele/consulta_cand/rede_social_candidato_2024.zip` | — |
| Coligações | `.../odsele/consulta_coligacao/consulta_coligacao_2024.zip` | — |
| Fotos BA | `.../eleicoes/eleicoes2024/fotos/foto_cand2024_BA_div.zip` | 1,08 GB |
| Votação por seção (BA) | `.../odsele/votacao_secao/votacao_secao_2024_BA.zip` | 114 MB |
| Detalhe apuração por seção | `.../odsele/detalhe_votacao_secao/detalhe_votacao_secao_2024.zip` | 87 MB |
| Votação nominal município/zona | `.../odsele/votacao_candidato_munzona/votacao_candidato_munzona_2024.zip` | 48 MB |
| Votação partido município/zona | `.../odsele/votacao_partido_munzona/votacao_partido_munzona_2024.zip` | — |
| Detalhe apuração município/zona | `.../odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_2024.zip` | — |
| Eleitorado por local de votação | `.../odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2024.zip` | 45 MB |
| Perfil do eleitorado por seção (BA) | `.../odsele/perfil_eleitor_secao/perfil_eleitor_secao_2024_BA.zip` | — |

## Formato dos CSVs

- Encoding: **latin-1**; separador **`;`**.
- `eleitorado_local_votacao_2024.csv` — colunas confirmadas:
  `DT_GERACAO, ... SG_UF, CD_MUNICIPIO, NM_MUNICIPIO, NR_ZONA, NR_SECAO, ... NR_LOCAL_VOTACAO, NM_LOCAL_VOTACAO, DS_ENDERECO, NM_BAIRRO, NR_CEP, NR_LATITUDE, NR_LONGITUDE, ... QT_ELEITOR_SECAO, QT_ELEITOR_ELEICAO_MUNICIPAL`.
  - **Contém coordenadas** e eleitores por seção.
  - O bairro vem do campo `NM_BAIRRO` do TSE (não é geocodificado a partir do endereço). É útil como conferência, mas usa nomes informais e não substitui o polígono oficial.

> Ainda a confirmar na implementação (colunas exatas de `consulta_cand` e `votacao_secao`): `SQ_CANDIDATO`, `NM_URNA_CANDIDATO`, `SG_PARTIDO`, `DS_CARGO`, `NR_CANDIDATO`, e os campos de voto por seção.

## Implicações de arquitetura

1. **Sem geocodificação**: usar `NR_LATITUDE`/`NR_LONGITUDE` dos locais de votação e fazer *point-in-polygon* contra os bairros oficiais.
2. **Bairro exibido = polígono oficial**; `NM_BAIRRO` do TSE serve como validação/cruzamento.
3. **Fotos**: o ZIP da BA é muito grande (~1 GB). Estratégia: baixar uma vez (cache), extrair **apenas** os candidatos de Salvador e gerar miniaturas otimizadas para o site. Não baixar em cada build.
4. **Dados de 2024 são estáticos**: o ETL pesado roda uma vez (ou manualmente); o GitHub Actions apenas faz build/deploy do site. Reexecução do ETL é opcional.
5. **Snapshot versionado**: guardar hash/tamanho de cada arquivo baixado para auditoria e reprodutibilidade.

## Ruff/qualidade

- Validar cobertura: toda seção de Salvador com coordenada? Quantas sem lat/long? Quanto do eleitorado é atribuído com precisão?
- Falhar o build se contagens essenciais divergirem (ex.: bairros da camada ArcGIS vigente ≠ 170; GPKG legado tem 173).
