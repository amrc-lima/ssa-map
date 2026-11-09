import json
import unicodedata

import geopandas as gpd
import pandas as pd
from shapely.geometry import shape

from .config import GEO_DIR
from .sources.tse import csv_files

LAT_BOUNDS = (-14.0, -12.0)
LON_BOUNDS = (-39.0, -37.0)

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
    sections = sal[["NR_ZONA", "NR_SECAO", "NR_LOCAL_VOTACAO", "NM_BAIRRO"]].copy()
    sections = sections.merge(spatial, on=["NR_ZONA", "NR_SECAO"], how="left")
    sections["bairro_nome"] = sections["NM_BAIRRO"].map(norm).map(official)
    sections["bairro_id"] = sections["bairro_espacial"].fillna(sections["bairro_nome"]).astype("Int64")

    sections["origem"] = None
    sections.loc[sections["bairro_espacial"].notna(), "origem"] = "coordenada"
    sections.loc[
        sections["bairro_espacial"].isna() & sections["bairro_nome"].notna(), "origem"
    ] = "nome"

    stats = {
        "secoes_total": int(len(sal)),
        "secoes_com_coordenada": int(valid.sum()),
        "secoes_mapeadas": int(sections["bairro_id"].notna().sum()),
        "secoes_por_coordenada": int((sections["origem"] == "coordenada").sum()),
        "secoes_por_nome": int((sections["origem"] == "nome").sum()),
        "secoes_sem_bairro": int(sections["bairro_id"].isna().sum()),
        "locais_distintos": int(sal["NR_LOCAL_VOTACAO"].nunique()),
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
