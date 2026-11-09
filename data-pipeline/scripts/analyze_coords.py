import pandas as pd

from ssa_etl.geo import LAT_BOUNDS, LON_BOUNDS, LOCAIS_COLS
from ssa_etl.sources.tse import csv_files

path = next(p for p in csv_files("locais_votacao") if p.name == "eleitorado_local_votacao_2024.csv")
loc = pd.read_csv(path, sep=";", encoding="latin-1", dtype=str, usecols=LOCAIS_COLS)
sal = loc[(loc["SG_UF"] == "BA") & (loc["NM_MUNICIPIO"] == "SALVADOR")].copy()
lat = pd.to_numeric(sal["NR_LATITUDE"], errors="coerce")
lon = pd.to_numeric(sal["NR_LONGITUDE"], errors="coerce")
sal["ok"] = lat.between(*LAT_BOUNDS) & lon.between(*LON_BOUNDS)

by_local = sal.groupby(["NR_ZONA", "NR_LOCAL_VOTACAO"]).agg(
    secoes=("NR_SECAO", "size"),
    com_coord=("ok", "sum"),
)
print("locais:", len(by_local))
print("locais com ao menos 1 coord:", int((by_local["com_coord"] > 0).sum()))
print("locais sem nenhuma coord:", int((by_local["com_coord"] == 0).sum()))
print("\ndistribuicao secoes por local com/sem coord:")
print(
    sal.groupby(["NR_ZONA", "NR_LOCAL_VOTACAO"])["ok"]
    .agg(["size", "sum"])
    .assign(sem=lambda d: d["size"] - d["sum"])
    .groupby(["sum", "sem"])
    .size()
    .sort_values(ascending=False)
    .head(10)
    .to_string()
)

print("\nexemplos de linhas invalidas cujo local tem alguma valida:")
mixed = by_local[(by_local["com_coord"] > 0) & (by_local["com_coord"] < by_local["secoes"])]
print("locais mistos:", len(mixed))
sample = sal.merge(mixed.reset_index()[["NR_ZONA", "NR_LOCAL_VOTACAO"]], on=["NR_ZONA", "NR_LOCAL_VOTACAO"])
print(sample[sample["ok"] == False][["NR_ZONA", "NR_SECAO", "NR_LOCAL_VOTACAO", "NM_LOCAL_VOTACAO", "NR_LATITUDE", "NR_LONGITUDE"]].head(8).to_string(index=False))
