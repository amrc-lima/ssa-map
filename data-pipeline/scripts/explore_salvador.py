from pathlib import Path

import pandas as pd

from ssa_etl.sources.tse import csv_files

pd.set_option("display.width", 200)
pd.set_option("display.max_columns", 50)


def find(name: str, filename: str) -> Path:
    return next(p for p in csv_files(name) if p.name == filename)


cand_path = find("consulta_cand", "consulta_cand_2024_BA.csv")
cand_cols = ["CD_ELEICAO", "DS_ELEICAO", "SG_UF", "SG_UE", "NM_UE", "CD_CARGO", "DS_CARGO", "SQ_CANDIDATO", "NR_CANDIDATO", "NM_URNA_CANDIDATO", "SG_PARTIDO"]
cand = pd.read_csv(cand_path, sep=";", encoding="latin-1", dtype=str, usecols=cand_cols)
print("consulta_cand BA:", len(cand), "linhas")
print(cand.groupby(["CD_ELEICAO", "DS_ELEICAO"]).size().to_string())
sal = cand[(cand["CD_ELEICAO"] == "619") & (cand["NM_UE"] == "SALVADOR")]
print("\nSalvador 2024 (CD_ELEICAO=619):", len(sal))
print(sal.groupby(["CD_CARGO", "DS_CARGO"]).size().to_string())
print("\nExemplos de nomes de urna:")
print(sal[["DS_CARGO", "NM_URNA_CANDIDATO", "SG_PARTIDO", "NR_CANDIDATO", "SQ_CANDIDATO"]].head(8).to_string(index=False))

loc_path = find("locais_votacao", "eleitorado_local_votacao_2024.csv")
loc_cols = ["SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO", "NR_ZONA", "NR_SECAO", "CD_TIPO_SECAO_AGREGADA", "DS_TIPO_SECAO_AGREGADA", "NR_LOCAL_VOTACAO", "NM_LOCAL_VOTACAO", "NM_BAIRRO", "NR_LATITUDE", "NR_LONGITUDE", "QT_ELEITOR_SECAO"]
loc = pd.read_csv(loc_path, sep=";", encoding="latin-1", dtype=str, usecols=loc_cols)
print("\neleitorado_local_votacao total:", len(loc), "linhas")
loc_sal = loc[(loc["SG_UF"] == "BA") & (loc["NM_MUNICIPIO"] == "SALVADOR")]
print("Salvador:", len(loc_sal), "linhas |",
      loc_sal["NR_ZONA"].nunique(), "zonas |",
      loc_sal["NR_LOCAL_VOTACAO"].nunique(), "locais |",
      loc_sal["NR_SECAO"].nunique(), "secoes")
print("Tipos de secao:")
print(loc_sal.groupby(["CD_TIPO_SECAO_AGREGADA", "DS_TIPO_SECAO_AGREGADA"]).size().to_string())
dup = loc_sal.duplicated(subset=["NR_ZONA", "NR_SECAO"]).sum()
print("duplicatas (zona,secao):", dup)

lat = pd.to_numeric(loc_sal["NR_LATITUDE"], errors="coerce")
lon = pd.to_numeric(loc_sal["NR_LONGITUDE"], errors="coerce")
valid = lat.notna() & lon.notna() & (lat != 0) & (lon != 0)
print("secoes com coordenada valida:", int(valid.sum()), "de", len(loc_sal))
print("lat range:", lat[valid].min(), lat[valid].max(), "| lon range:", lon[valid].min(), lon[valid].max())
print("\nLocais de Salvador (amostra):")
print(loc_sal[["NR_ZONA", "NR_SECAO", "NM_LOCAL_VOTACAO", "NM_BAIRRO", "NR_LATITUDE", "NR_LONGITUDE"]].head(5).to_string(index=False))
