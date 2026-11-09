import pandas as pd
from ssa_etl.config import CACHE_DIR
from ssa_etl.sources.tse import csv_files

path = next(p for p in csv_files("locais_votacao") if p.name == "eleitorado_local_votacao_2024.csv")
loc = pd.read_csv(path, sep=";", encoding="latin-1", dtype=str)
print("colunas:", list(loc.columns))
sal = loc[(loc["SG_UF"] == "BA") & (loc["NM_MUNICIPIO"] == "SALVADOR")].copy()
print("linhas Salvador:", len(sal))
print("locais (zona+local):", sal.groupby(["NR_ZONA", "NR_LOCAL_VOTACAO"]).ngroups)
print("locais (NR_LOCAL_VOTACAO isolado):", sal["NR_LOCAL_VOTACAO"].nunique())

for term in ["CAMINHO", "AMARALINA", "HORTO", "TORORO", "COMERCIO", "COMÉRCIO", "VITORIA", "VITÓRIA", "SANTO ANTONIO", "SANTO ANTÔNIO"]:
    mask = sal.apply(lambda row: term in " ".join(str(v) for v in row.values).upper(), axis=1)
    sub = sal[mask]
    print(f"\n=== {term}: {len(sub)} linhas")
    if len(sub):
        cols = ["NR_ZONA", "NR_SECAO", "NR_LOCAL_VOTACAO", "NM_LOCAL_VOTACAO", "NM_BAIRRO", "DS_ENDERECO"]
        cols = [c for c in cols if c in sub.columns]
        print(sub[cols].head(15).to_string(index=False))

print("\nBairros TSE que não batem com nenhum bairro oficial (top 60 por seções):")
print(sal["NM_BAIRRO"].fillna("<vazio>").value_counts().head(60).to_string())
