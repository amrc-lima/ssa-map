import pandas as pd
from pathlib import Path

path = Path("cache/extracted/consulta_cand/consulta_cand_2024_BA.csv")
cols = [
    "CD_ELEICAO", "NM_UE", "CD_CARGO", "SQ_CANDIDATO", "NM_URNA_CANDIDATO",
    "SG_PARTIDO", "NM_PARTIDO", "NR_PARTIDO", "TP_AGREMIACAO", "NR_FEDERACAO",
    "NM_FEDERACAO", "SG_FEDERACAO", "DS_COMPOSICAO_FEDERACAO", "NM_COLIGACAO",
    "DS_COMPOSICAO_COLIGACAO", "DS_SIT_TOT_TURNO",
]
df = pd.read_csv(path, sep=";", encoding="latin-1", dtype=str, usecols=cols)
sal = df[(df["CD_ELEICAO"] == "619") & (df["NM_UE"] == "SALVADOR") & (df["CD_CARGO"] == "13")].copy()
print(sal["TP_AGREMIACAO"].value_counts(dropna=False).to_string())
print("\nFEDERAÇÕES:")
print(
    sal.groupby(["NR_FEDERACAO", "SG_FEDERACAO", "NM_FEDERACAO", "DS_COMPOSICAO_FEDERACAO", "NM_COLIGACAO"], dropna=False)
    .agg(candidatos=("SQ_CANDIDATO", "size"), partidos=("SG_PARTIDO", lambda s: sorted(set(s))))
    .to_string()
)
