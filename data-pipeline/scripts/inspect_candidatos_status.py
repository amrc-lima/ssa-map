import pandas as pd
from pathlib import Path

path = Path("cache/extracted/consulta_cand/consulta_cand_2024_BA.csv")
cols = [
    "CD_ELEICAO", "NM_UE", "CD_CARGO", "DS_CARGO", "SQ_CANDIDATO", "NR_CANDIDATO",
    "NM_URNA_CANDIDATO", "SG_PARTIDO", "NM_PARTIDO", "NR_PARTIDO", "SQ_COLIGACAO",
    "NM_COLIGACAO", "DS_COMPOSICAO_COLIGACAO", "DS_SIT_TOT_TURNO", "DS_SITUACAO_CANDIDATURA",
]
df = pd.read_csv(path, sep=";", encoding="latin-1", dtype=str, usecols=cols)
sal = df[(df["CD_ELEICAO"] == "619") & (df["NM_UE"] == "SALVADOR") & (df["CD_CARGO"].isin(["11", "13"]))].copy()
for cargo in ["11", "13"]:
    sub = sal[sal["CD_CARGO"] == cargo]
    print("=" * 100)
    print("CARGO", cargo, sub["DS_CARGO"].iloc[0], "candidatos", len(sub))
    print("\nDS_SIT_TOT_TURNO:")
    print(sub["DS_SIT_TOT_TURNO"].value_counts(dropna=False).to_string())
    print("\nDS_SITUACAO_CANDIDATURA:")
    print(sub["DS_SITUACAO_CANDIDATURA"].value_counts(dropna=False).to_string())
    print("\ncoligações:")
    print(sub.groupby(["SQ_COLIGACAO", "NM_COLIGACAO"]).size().sort_values(ascending=False).head(40).to_string())
    print("\npartidos:")
    print(sub.groupby(["NR_PARTIDO", "SG_PARTIDO"]).size().sort_values(ascending=False).to_string())
