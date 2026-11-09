import pandas as pd

from ssa_etl.config import CACHE_DIR

vot = pd.read_csv(
    CACHE_DIR / "derived" / "votacao_salvador.csv.gz",
    dtype={"NR_ZONA": str, "NR_SECAO": str, "CD_CARGO": str, "SQ_CANDIDATO": str},
)
print("colunas:", list(vot.columns))
sq = pd.to_numeric(vot["SQ_CANDIDATO"], errors="coerce")
non = vot[~(sq > 0)]
legenda = non[~non["NR_VOTAVEL"].astype(str).isin(["95", "96"])]
print("\nlegenda linhas:", len(legenda), "| votos:", int(legenda["QT_VOTOS"].sum()))
print("\ncolunas de partido em legenda:")
print(legenda[["NR_VOTAVEL", "NM_VOTAVEL", "NR_PARTIDO", "NM_PARTIDO", "QT_VOTOS"]].head(10).to_string())
print("\npor NR_PARTIDO:")
print(
    legenda.groupby(["NR_PARTIDO", "NM_PARTIDO"])
    .agg(linhas=("QT_VOTOS", "size"), votos=("QT_VOTOS", "sum"))
    .sort_values("votos", ascending=False)
    .to_string()
)
