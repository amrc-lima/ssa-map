import json
import unicodedata

import geopandas as gpd
import pandas as pd
from shapely.geometry import shape

from .config import GEO_DIR
from .sources.tse import csv_files

LAT_BOUNDS = (-14.0, -12.0)
LON_BOUNDS = (-39.0, -37.0)

# Nomes usados pelo cadastro do TSE que não existem, com esse nome, na divisão
# oficial de bairros de Salvador. O primeiro bloco é o mapeamento validado com
# os endereços dos locais; os dois primeiros ficam marcados como "média".
TSE_BAIRRO_ALIASES = {
    "ARMAÇÃO": "Jardim Armação",
    "BOM JESUS DOS PASSOS": "Ilha de Bom Jesus dos Passos",
    "PARQUE SÃO CRISTÓVÃO": "São Cristóvão",
    "CAMPINAS": "Campinas de Pirajá",
    "CAMPINAS DE BROTAS": "Brotas",
    "SÃO TOMÉ DE PARIPE": "São Tomé",
    "ALTO DE COUTOS": "Coutos",
    "VASCO DA GAMA": "Acupe",
    "BONOCÔ": "Brotas",
    "NOVA BRASÍLIA DE ITAPUÃ": "Itapuã",
    "NOVA BRASÍLIA DE VALÉRIA": "Moradas da Lagoa",
    "TUBARÃO": "Paripe",
    "PARAMANA": "Ilha dos Frades/Ilha de Santo Antônio",
}

# Nomes que existem nos dois cadastros, mas cujo ponto geocodificado cai no
# bairro vizinho. Nesses casos o nome do TSE é mais confiável que a coordenada.
TSE_BAIRRO_NOME_PRIORITARIO = {
    "BOCA DA MATA",
    "CASSANGE",
    "CHAME-CHAME",
    "MASSARANDUBA",
    "RETIRO",
}

LOCAIS_COLS = [
    "SG_UF",
    "CD_MUNICIPIO",
    "NM_MUNICIPIO",
    "NR_ZONA",
    "NR_SECAO",
    "NR_LOCAL_VOTACAO",
    "NM_LOCAL_VOTACAO",
    "NM_BAIRRO",
    "NR_LATITUDE",
    "NR_LONGITUDE",
    "QT_ELEITOR_SECAO",
]


def load_bairros() -> gpd.GeoDataFrame:
    data = json.loads((GEO_DIR / "bairros.geojson").read_text(encoding="utf-8"))
    rows = []
    for index, feature in enumerate(data["features"]):
        props = feature.get("properties") or {}
        bairro_id = props.get("id")
        rows.append(
            {
                "bairro_id": int(bairro_id) if bairro_id is not None else index + 1,
                "nome": (props.get("nome") or "").strip(),
                "geometry": shape(feature["geometry"]),
            }
        )
    gdf = gpd.GeoDataFrame(rows, crs="EPSG:4326")
    gdf["geometry"] = gdf.geometry.make_valid()
    return gdf


def norm(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode()
    return " ".join(text.upper().replace("-", " ").replace("'", " ").split())


def load_locais(bairros: gpd.GeoDataFrame) -> tuple[pd.DataFrame, dict]:
    path = next(
        p
        for p in csv_files("locais_votacao")
        if p.name == "eleitorado_local_votacao_2024.csv"
    )
    loc = pd.read_csv(
        path, sep=";", encoding="latin-1", dtype=str, usecols=LOCAIS_COLS
    )
    sal = loc[(loc["SG_UF"] == "BA") & (loc["NM_MUNICIPIO"] == "SALVADOR")].copy()

    lat = pd.to_numeric(sal["NR_LATITUDE"], errors="coerce")
    lon = pd.to_numeric(sal["NR_LONGITUDE"], errors="coerce")
    valid = lat.between(*LAT_BOUNDS) & lon.between(*LON_BOUNDS)
    sal["lat"] = lat
    sal["lon"] = lon

    valid_rows = sal[valid].copy()
    points = gpd.GeoDataFrame(
        valid_rows,
        geometry=gpd.points_from_xy(valid_rows["lon"], valid_rows["lat"]),
        crs="EPSG:4326",
    )
    joined = gpd.sjoin(
        points, bairros[["bairro_id", "geometry"]], how="left", predicate="within"
    )
    joined = joined.sort_values("bairro_id", na_position="last").drop_duplicates(
        subset=["NR_ZONA", "NR_SECAO"]
    )
    spatial = joined[["NR_ZONA", "NR_SECAO", "bairro_id"]].rename(
        columns={"bairro_id": "bairro_espacial"}
    )

    official = {norm(nome): int(bairro_id) for bairro_id, nome in zip(bairros["bairro_id"], bairros["nome"])}
    alias: dict[str, int] = {}
    for tse_nome, oficial_nome in TSE_BAIRRO_ALIASES.items():
        chave = norm(oficial_nome)
        if chave not in official:
            raise ValueError(f"Bairro oficial do alias não encontrado: {oficial_nome!r}")
        alias[norm(tse_nome)] = official[chave]

    sections = sal[["NR_ZONA", "NR_SECAO", "NR_LOCAL_VOTACAO", "NM_BAIRRO"]].copy()
    sections = sections.merge(spatial, on=["NR_ZONA", "NR_SECAO"], how="left")
    sections["bairro_nome"] = sections["NM_BAIRRO"].map(norm).map(official)
    sections["bairro_alias"] = sections["NM_BAIRRO"].map(norm).map(alias)
    nomes_prioritarios = {norm(nome) for nome in TSE_BAIRRO_NOME_PRIORITARIO}
    force_name = sections["NM_BAIRRO"].map(norm).isin(nomes_prioritarios)

    # Ordem: aliases curados > nome exato prioritário > coordenada > nome exato.
    # Para os nomes prioritários, o ponto geocodificado cai no bairro vizinho;
    # para os aliases, o nome do TSE é uma localidade que não existe no GeoJSON.
    sections["bairro_id"] = sections["bairro_alias"].copy()
    sections.loc[force_name & sections["bairro_nome"].notna(), "bairro_id"] = sections.loc[
        force_name & sections["bairro_nome"].notna(), "bairro_nome"
    ]
    sections["bairro_id"] = (
        sections["bairro_id"]
        .fillna(sections["bairro_espacial"])
        .fillna(sections["bairro_nome"])
        .astype("Int64")
    )

    sections["origem"] = None
    sections.loc[sections["bairro_alias"].notna(), "origem"] = "alias"
    sections.loc[
        force_name & sections["bairro_nome"].notna(), "origem"
    ] = "nome_prioritario"
    sections.loc[
        sections["origem"].isna() & sections["bairro_espacial"].notna(), "origem"
    ] = "coordenada"
    sections.loc[
        sections["origem"].isna() & sections["bairro_nome"].notna(), "origem"
    ] = "nome"

    official_by_id = {
        int(bairro_id): nome for bairro_id, nome in zip(bairros["bairro_id"], bairros["nome"])
    }
    sections["bairro_oficial"] = sections["bairro_id"].map(official_by_id)

    stats = {
        "secoes_total": int(len(sal)),
        "secoes_com_coordenada": int(valid.sum()),
        "secoes_mapeadas": int(sections["bairro_id"].notna().sum()),
        "secoes_por_alias": int((sections["origem"] == "alias").sum()),
        "secoes_por_nome_prioritario": int(
            (sections["origem"] == "nome_prioritario").sum()
        ),
        "secoes_por_coordenada": int((sections["origem"] == "coordenada").sum()),
        "secoes_por_nome": int((sections["origem"] == "nome").sum()),
        "secoes_sem_bairro": int(sections["bairro_id"].isna().sum()),
        "locais_distintos": int(sal.groupby(["NR_ZONA", "NR_LOCAL_VOTACAO"]).ngroups),
    }
    return sections, stats


def load_candidatos() -> pd.DataFrame:
    path = next(
        p for p in csv_files("consulta_cand") if p.name == "consulta_cand_2024_BA.csv"
    )
    cols = [
        "CD_ELEICAO",
        "SG_UF",
        "NM_UE",
        "CD_CARGO",
        "DS_CARGO",
        "SQ_CANDIDATO",
        "NR_CANDIDATO",
        "NM_CANDIDATO",
        "NM_URNA_CANDIDATO",
        "SG_PARTIDO",
        "NM_PARTIDO",
        "NR_PARTIDO",
        "TP_AGREMIACAO",
        "NR_FEDERACAO",
        "SG_FEDERACAO",
        "NM_FEDERACAO",
        "DS_COMPOSICAO_FEDERACAO",
        "SQ_COLIGACAO",
        "NM_COLIGACAO",
        "DS_COMPOSICAO_COLIGACAO",
        "DS_SITUACAO_CANDIDATURA",
        "DS_SIT_TOT_TURNO",
    ]
    cand = pd.read_csv(path, sep=";", encoding="latin-1", dtype=str, usecols=cols)
    sal = cand[
        (cand["CD_ELEICAO"] == "619")
        & (cand["NM_UE"] == "SALVADOR")
        & (cand["CD_CARGO"].isin(["11", "13"]))
    ].copy()
    return sal.drop_duplicates(subset=["SQ_CANDIDATO"])
