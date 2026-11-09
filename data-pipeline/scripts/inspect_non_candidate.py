import pandas as pd

from ssa_etl.config import CACHE_DIR

vot = pd.read_csv(
    CACHE_DIR / "derived" / "votacao_salvador.csv.gz",
    dtype={"NR_ZONA": str, "NR_SECAO": str, "CD_CARGO": str, "SQ_CANDIDATO": str},
)
sq = pd.to_numeric(vot["SQ_CANDIDATO"], errors="coerce")
non = vot[~(sq > 0)]
print("linhas sem candidato:", len(non), "| votos:", int(non["QT_VOTOS"].sum()))
resumo = (
    non.groupby(["CD_CARGO", "DS_CARGO", "NR_VOTAVEL", "NM_VOTAVEL"])
    .agg(linhas=("QT_VOTOS", "size"), votos=("QT_VOTOS", "sum"))
    .sort_values("votos", ascending=False)
)
print(resumo.head(40).to_string())
