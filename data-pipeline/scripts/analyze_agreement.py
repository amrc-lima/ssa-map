import unicodedata

import geopandas as gpd
import pandas as pd

from ssa_etl.geo import LAT_BOUNDS, LON_BOUNDS, LOCAIS_COLS, load_bairros
from ssa_etl.sources.tse import csv_files


def norm(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode()
    return " ".join(text.upper().replace("-", " ").replace("'", " ").split())


bairros = load_bairros()
bairros["nome_norm"] = bairros["nome"].map(norm)

path = next(p for p in csv_files("locais_votacao") if p.name == "eleitorado_local_votacao_2024.csv")
loc = pd.read_csv(path, sep=";", encoding="latin-1", dtype=str, usecols=LOCAIS_COLS)
sal = loc[(loc["SG_UF"] == "BA") & (loc["NM_MUNICIPIO"] == "SALVADOR")].copy()
lat = pd.to_numeric(sal["NR_LATITUDE"], errors="coerce")
lon = pd.to_numeric(sal["NR_LONGITUDE"], errors="coerce")
sal["ok"] = lat.between(*LAT_BOUNDS) & lon.between(*LON_BOUNDS)
sal["bairro_tse_norm"] = sal["NM_BAIRRO"].map(norm)

valid = sal[sal["ok"]].copy()
pts = gpd.GeoDataFrame(
    valid,
    geometry=gpd.points_from_xy(pd.to_numeric(valid["NR_LONGITUDE"]), pd.to_numeric(valid["NR_LATITUDE"])),
    crs="EPSG:4326",
)
joined = gpd.sjoin(pts, bairros[["bairro_id", "nome", "nome_norm", "geometry"]], how="left", predicate="within")
joined = joined.sort_values("bairro_id", na_position="last").drop_duplicates(subset=["NR_ZONA", "NR_SECAO"])

both = joined.dropna(subset=["bairro_id"])
match_tse = both["bairro_tse_norm"].isin(set(bairros["nome_norm"]))
comparable = both[match_tse].copy()
agree = comparable["bairro_tse_norm"] == comparable["nome_norm"]
print(f"seções com coord: {len(valid)} | mapeadas em polígono: {len(both)}")
print(f"com NM_BAIRRO reconhecido: {len(comparable)} ({len(comparable)/len(both):.1%})")
print(f"concordância NM_BAIRRO == polígono: {agree.mean():.1%} ({int(agree.sum())}/{len(comparable)})")

print("\nTop divergências (NM_BAIRRO TSE -> bairro do polígono):")
diff = comparable[~agree]
print(
    diff.groupby(["bairro_tse_norm", "nome_norm"]).size().sort_values(ascending=False).head(15).to_string()
)
