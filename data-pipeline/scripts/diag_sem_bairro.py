import pandas as pd

from ssa_etl.geo import LAT_BOUNDS, LON_BOUNDS, load_bairros, load_locais, norm
from ssa_etl.config import CACHE_DIR
from ssa_etl.sources.tse import csv_files

bairros = load_bairros()
sections, stats = load_locais(bairros)
sem = sections[sections["bairro_id"].isna()].copy()
print("sem bairro:", len(sem))
print(sem["NM_BAIRRO"].fillna("<vazio>").value_counts().to_string())

path = next(p for p in csv_files("locais_votacao") if p.name == "eleitorado_local_votacao_2024.csv")
loc = pd.read_csv(path, sep=";", encoding="latin-1", dtype=str)
sal = loc[(loc["SG_UF"] == "BA") & (loc["NM_MUNICIPIO"] == "SALVADOR")].copy()
sal["lat"] = pd.to_numeric(sal["NR_LATITUDE"], errors="coerce")
sal["lon"] = pd.to_numeric(sal["NR_LONGITUDE"], errors="coerce")
sal["coord_valida"] = sal["lat"].between(*LAT_BOUNDS) & sal["lon"].between(*LON_BOUNDS)
merged = sem.merge(
    sal[["NR_ZONA", "NR_SECAO", "NM_LOCAL_VOTACAO", "DS_ENDERECO", "lat", "lon", "coord_valida"]],
    on=["NR_ZONA", "NR_SECAO"],
    how="left",
)

print("\nPor nome: seções, com coordenada válida, exemplos")
for name, grupo in merged.groupby(merged["NM_BAIRRO"].fillna("<vazio>")):
    print(f"\n### {name} | seções={len(grupo)} | coord válida={int(grupo['coord_valida'].sum())}")
    for _, row in grupo.head(4).iterrows():
        print(f"  z{row['NR_ZONA']} s{row['NR_SECAO']} | {row['NM_LOCAL_VOTACAO']} | {row['DS_ENDERECO']} | lat={row['lat']} lon={row['lon']}")
