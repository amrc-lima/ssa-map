from pathlib import Path

import pandas as pd

from ssa_etl.config import CACHE_DIR
from ssa_etl.sources.tse import csv_files

DERIVED = CACHE_DIR / "derived"
DERIVED.mkdir(parents=True, exist_ok=True)

path = next(p for p in csv_files("votacao_secao_ba") if p.name == "votacao_secao_2024_BA.csv")

usecols = [
    "CD_ELEICAO",
    "NR_TURNO",
    "SG_UF",
    "CD_MUNICIPIO",
    "NM_MUNICIPIO",
    "NR_ZONA",
    "NR_SECAO",
    "CD_CARGO",
    "DS_CARGO",
    "NR_VOTAVEL",
    "NM_VOTAVEL",
    "QT_VOTOS",
    "NR_LOCAL_VOTACAO",
    "SQ_CANDIDATO",
]

parts = []
total_rows = 0
for chunk in pd.read_csv(
    path, sep=";", encoding="latin-1", dtype=str, usecols=usecols, chunksize=500_000
):
    total_rows += len(chunk)
    mask = (
        (chunk["CD_ELEICAO"] == "619")
        & (chunk["NM_MUNICIPIO"] == "SALVADOR")
        & (chunk["NR_TURNO"] == "1")
    )
    if mask.any():
        parts.append(chunk[mask])

print("linhas lidas da BA:", total_rows)
vot = pd.concat(parts, ignore_index=True)
vot["QT_VOTOS"] = pd.to_numeric(vot["QT_VOTOS"], errors="coerce").fillna(0).astype("int64")
print("linhas de Salvador:", len(vot))
print("votos totais:", int(vot["QT_VOTOS"].sum()))
print("\npor cargo:")
print(vot.groupby(["CD_CARGO", "DS_CARGO"]).agg(linhas=("QT_VOTOS", "size"), votos=("QT_VOTOS", "sum")).to_string())
cand = vot[vot["SQ_CANDIDATO"].notna() & (vot["SQ_CANDIDATO"] != "-1")]
print("\nlinhas com candidato:", len(cand), "| candidatos distintos:", cand["SQ_CANDIDATO"].nunique())
print("linhas sem candidato (branco/nulo/legenda):", len(vot) - len(cand))

try:
    import pyarrow  # noqa: F401

    out = DERIVED / "votacao_salvador.parquet"
    vot.to_parquet(out, index=False)
except ImportError:
    out = DERIVED / "votacao_salvador.csv.gz"
    vot.to_csv(out, index=False, encoding="utf-8", compression="gzip")
print("\nsalvo em:", out, f"({out.stat().st_size / 1e6:.1f} MB)")
