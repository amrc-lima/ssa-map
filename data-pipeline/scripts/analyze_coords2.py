import unicodedata

import pandas as pd

from ssa_etl.geo import LAT_BOUNDS, LON_BOUNDS, LOCAIS_COLS, load_bairros
from ssa_etl.sources.tse import csv_files


def norm(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode()
    return " ".join(text.upper().replace("-", " ").replace("'", " ").split())


path = next(p for p in csv_files("locais_votacao") if p.name == "eleitorado_local_votacao_2024.csv")
loc = pd.read_csv(path, sep=";", encoding="latin-1", dtype=str, usecols=LOCAIS_COLS + ["CD_TIPO_LOCAL", "DS_TIPO_LOCAL"])
sal = loc[(loc["SG_UF"] == "BA") & (loc["NM_MUNICIPIO"] == "SALVADOR")].copy()
lat = pd.to_numeric(sal["NR_LATITUDE"], errors="coerce")
lon = pd.to_numeric(sal["NR_LONGITUDE"], errors="coerce")
sal["ok"] = lat.between(*LAT_BOUNDS) & lon.between(*LON_BOUNDS)
sal["bairro_norm"] = sal["NM_BAIRRO"].map(norm)

bairros = load_bairros()
official = {norm(n): n for n in bairros["nome"]}
sal["match_oficial"] = sal["bairro_norm"].isin(official)

print("secoes totais:", len(sal), "| com coord:", int(sal["ok"].sum()), "| sem coord:", int((~sal["ok"]).sum()))
print("\npor zona (secoes / com coord / sem coord):")
z = sal.groupby("NR_ZONA").agg(secoes=("NR_SECAO", "size"), com_coord=("ok", "sum"))
z["sem_coord"] = z["secoes"] - z["com_coord"]
print(z.to_string())

print("\nNM_BAIRRO das secoes SEM coordenada — top 20:")
print(sal[~sal["ok"]].groupby("NM_BAIRRO").size().sort_values(ascending=False).head(20).to_string())

sem = sal[~sal["ok"]]
print("\nsecoes sem coord:", len(sem))
print("  com NM_BAIRRO que casa com bairro oficial:", int(sem["match_oficial"].sum()), f"({sem['match_oficial'].mean():.1%})")
print("  bairros oficiais distintos cobertos:", sem.loc[sem['match_oficial'], 'bairro_norm'].nunique())

print("\nsecoes COM coord cujo NM_BAIRRO casa com oficial:", f"{sal.loc[sal['ok'],'match_oficial'].mean():.1%}")

print("\nTipos de local:")
print(sal.groupby(["CD_TIPO_LOCAL", "DS_TIPO_LOCAL", "ok"]).size().to_string())
