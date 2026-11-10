import pandas as pd

from ssa_etl.config import CACHE_DIR
from ssa_etl.geo import load_candidatos

VOTACAO_PATH = CACHE_DIR / "derived" / "votacao_salvador.csv.gz"

vot = pd.read_csv(
    VOTACAO_PATH,
    dtype={"NR_ZONA": str, "NR_SECAO": str, "CD_CARGO": str, "SQ_CANDIDATO": str},
)
vot["QT_VOTOS"] = pd.to_numeric(vot["QT_VOTOS"], errors="coerce").fillna(0).astype("int64")
sq = pd.to_numeric(vot["SQ_CANDIDATO"], errors="coerce")
cand = vot[sq > 0]
totais = cand.groupby("SQ_CANDIDATO")["QT_VOTOS"].sum()

meta = load_candidatos()
meta = meta[meta["CD_CARGO"] == "13"].copy()
meta["votos"] = meta["SQ_CANDIDATO"].map(totais).fillna(0).astype("int64")

meta["agremiacao_key"] = meta["SG_PARTIDO"]
meta["agremiacao_label"] = meta["NM_PARTIDO"]
fed = meta["TP_AGREMIACAO"] == "FEDERAÇÃO"
meta.loc[fed, "agremiacao_key"] = meta.loc[fed, "SG_FEDERACAO"]
meta.loc[fed, "agremiacao_label"] = meta.loc[fed, "NM_FEDERACAO"]

numero_para_sigla = meta.drop_duplicates("NR_PARTIDO").set_index("NR_PARTIDO")["SG_PARTIDO"].to_dict()
party_to_agg = meta.drop_duplicates("SG_PARTIDO").set_index("SG_PARTIDO")["agremiacao_key"].to_dict()

vot["NR_VOTAVEL"] = vot["NR_VOTAVEL"].astype(str).str.strip()
legenda = vot[
    (sq <= 0)
    & vot["CD_CARGO"].eq("13")
    & vot["NR_VOTAVEL"].str.fullmatch(r"\d{2}")
    & vot["NR_VOTAVEL"].isin(numero_para_sigla)
].copy()
legenda["agremiacao_key"] = legenda["NR_VOTAVEL"].map(numero_para_sigla).map(party_to_agg)
legenda_agg = legenda.groupby("agremiacao_key")["QT_VOTOS"].sum()

validos = int(meta["votos"].sum() + legenda["QT_VOTOS"].sum())
seats = int(meta["DS_SIT_TOT_TURNO"].str.startswith("ELEITO").sum())
qe = validos // seats
limite10 = qe * 0.1

agg_votos = meta.groupby("agremiacao_key")["votos"].sum().add(legenda_agg, fill_value=0).astype("int64")
agg_label = meta.drop_duplicates("agremiacao_key").set_index("agremiacao_key")["agremiacao_label"]
meta["agremiacao_votos"] = meta["agremiacao_key"].map(agg_votos).astype("int64")
meta["qp"] = (meta["agremiacao_votos"] // qe).astype(int)

print(f"válidos={validos:,} cadeiras={seats} QE={qe:,} 10%={limite10:,.1f}")
print("\nagremiações:")
for key, votos in agg_votos.sort_values(ascending=False).items():
    print(f"  {key:30s} {votos:>9,}  QP={votos // qe}  {agg_label.get(key, '')}")

print("\neleitos:")
eleitos = meta[meta["DS_SIT_TOT_TURNO"].str.startswith("ELEITO")].sort_values("votos", ascending=False)
for _, row in eleitos.iterrows():
    como = "próprios" if row["votos"] >= qe else "coeficiente"
    print(
        f"  {row['NM_URNA_CANDIDATO'][:35]:35s} {row['SG_PARTIDO']:12s} {row['agremiacao_key']:28s} "
        f"votos={row['votos']:>7,} {row['DS_SIT_TOT_TURNO']:18s} {como}"
    )

print("\nsuplentes com mais votos:")
for _, row in meta[meta["DS_SIT_TOT_TURNO"] == "SUPLENTE"].sort_values("votos", ascending=False).head(10).iterrows():
    print(f"  {row['NM_URNA_CANDIDATO'][:35]:35s} {row['SG_PARTIDO']:12s} votos={row['votos']:>7,} agg={row['agremiacao_votos']:>9,}")
