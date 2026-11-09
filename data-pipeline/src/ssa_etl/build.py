import hashlib
import json
from datetime import datetime, timezone

import pandas as pd

from .config import ANO, CACHE_DIR, DATA_DIR, MUNICIPIO, TSE_TURNO
from .geo import load_bairros, load_candidatos, load_locais

DERIVED = CACHE_DIR / "derived"
VOTACAO_PATH = DERIVED / "votacao_salvador.csv.gz"

PARTY_COLORS = {
    "PT": "#c8102e",
    "PSD": "#1b4f9c",
    "UNIÃO": "#0a3d91",
    "PL": "#1e5aa8",
    "PP": "#1d6fa5",
    "REPUBLICANOS": "#0e4c92",
    "MDB": "#009639",
    "PDT": "#e30613",
    "PSB": "#f5a623",
    "PSDB": "#0057a8",
    "NOVO": "#ff6a00",
    "PODE": "#00a650",
    "SOLIDARIEDADE": "#f07f00",
    "AVANTE": "#ffb800",
    "PRTB": "#2e7d32",
    "PCO": "#b71c1c",
    "PSTU": "#c62828",
    "PCB": "#8e0000",
    "PSOL": "#f4c20d",
    "REDE": "#00a19a",
    "CIDADANIA": "#00a0a0",
    "DC": "#1e88e5",
    "PMB": "#6d4c41",
    "PRD": "#e53935",
    "MOBILIZA": "#455a64",
    "PMN": "#fdd835",
    "AGIR": "#7e57c2",
}


def party_color(sigla: str) -> str:
    if sigla in PARTY_COLORS:
        return PARTY_COLORS[sigla]
    hue = int(hashlib.md5(sigla.encode("utf-8")).hexdigest(), 16) % 360
    return f"hsl({hue}, 62%, 42%)"


def _load_votacao() -> pd.DataFrame:
    if not VOTACAO_PATH.exists():
        raise FileNotFoundError(
            f"{VOTACAO_PATH} não existe. Rode primeiro o filtro da votação."
        )
    vot = pd.read_csv(
        VOTACAO_PATH,
        dtype={"NR_ZONA": str, "NR_SECAO": str, "CD_CARGO": str, "SQ_CANDIDATO": str},
    )
    vot["QT_VOTOS"] = pd.to_numeric(vot["QT_VOTOS"], errors="coerce").fillna(0).astype("int64")
    return vot


def build() -> dict:
    bairros = load_bairros()
    sections, geo_stats = load_locais(bairros)
    cand_meta = load_candidatos()
    vot = _load_votacao()

    print(
        "geo:",
        f"{geo_stats['secoes_mapeadas']}/{geo_stats['secoes_total']} seções mapeadas",
        f"({geo_stats['secoes_por_coordenada']} por coordenada, "
        f"{geo_stats['secoes_por_nome']} por nome)",
    )

    vot = vot.merge(
        sections[["NR_ZONA", "NR_SECAO", "bairro_id", "origem"]],
        on=["NR_ZONA", "NR_SECAO"],
        how="left",
    )

    sq = pd.to_numeric(vot["SQ_CANDIDATO"], errors="coerce")
    candidatos = vot[sq > 0]
    total_votos = int(vot["QT_VOTOS"].sum())
    total_cand = int(candidatos["QT_VOTOS"].sum())
    atribuidos = int(candidatos.dropna(subset=["bairro_id"])["QT_VOTOS"].sum())
    print(f"votos: {atribuidos:,} atribuídos de {total_cand:,} de candidatos ({atribuidos / total_cand:.1%})")

    agg = (
        candidatos.dropna(subset=["bairro_id"])
        .groupby(["SQ_CANDIDATO", "bairro_id"], as_index=False)["QT_VOTOS"]
        .sum()
    )
    totais = candidatos.groupby("SQ_CANDIDATO")["QT_VOTOS"].sum().to_dict()

    by_id = cand_meta.set_index("SQ_CANDIDATO")
    faltando = sorted(set(agg["SQ_CANDIDATO"]) - set(by_id.index))
    if faltando:
        print(f"aviso: {len(faltando)} candidatos com votos sem metadados: {faltando[:5]}")

    max_votos_bairro = int(agg["QT_VOTOS"].max()) if len(agg) else 0

    votos_por_candidato: dict[str, dict[str, int]] = {}
    for candidato_id, grupo in agg.groupby("SQ_CANDIDATO"):
        votos_por_candidato[str(candidato_id)] = {
            str(int(bid)): int(qtd) for bid, qtd in zip(grupo["bairro_id"], grupo["QT_VOTOS"])
        }

    candidatos_out = []
    for candidato_id, row in by_id.iterrows():
        if candidato_id not in totais:
            continue
        bairros_votos = votos_por_candidato.get(str(candidato_id), {})
        candidatos_out.append(
            {
                "id": str(candidato_id),
                "nome": row["NM_CANDIDATO"],
                "nome_urna": row["NM_URNA_CANDIDATO"],
                "numero": row["NR_CANDIDATO"],
                "cargo_id": row["CD_CARGO"],
                "cargo": row["DS_CARGO"],
                "partido": row["SG_PARTIDO"],
                "partido_nome": row["NM_PARTIDO"],
                "partido_numero": row["NR_PARTIDO"],
                "cor": party_color(row["SG_PARTIDO"]),
                "situacao": row["DS_SITUACAO_CANDIDATURA"],
                "resultado": row["DS_SIT_TOT_TURNO"],
                "votos_total": int(totais[candidato_id]),
                "votos_max_bairro": int(max(bairros_votos.values())) if bairros_votos else 0,
                "bairros_com_voto": len(bairros_votos),
            }
        )

    cargos = []
    for cargo_id, grupo in pd.DataFrame(candidatos_out).groupby("cargo_id"):
        grupo = grupo.sort_values(["votos_total", "nome_urna"], ascending=[False, True])
        cargos.append(
            {
                "id": str(cargo_id),
                "nome": grupo.iloc[0]["cargo"],
                "candidatos": grupo.to_dict(orient="records"),
            }
        )
    cargos.sort(key=lambda c: {"11": 0, "13": 1}.get(c["id"], 9))

    mapeados = candidatos.dropna(subset=["bairro_id"])
    votos_bairro = mapeados.groupby("bairro_id")["QT_VOTOS"].sum()
    votos_coord = mapeados[mapeados["origem"] == "coordenada"].groupby("bairro_id")["QT_VOTOS"].sum()
    bairros_out = []
    for bairro_id, nome in zip(bairros["bairro_id"], bairros["nome"]):
        total = int(votos_bairro.get(bairro_id, 0))
        coord = int(votos_coord.get(bairro_id, 0))
        bairros_out.append(
            {
                "id": int(bairro_id),
                "nome": nome,
                "votos_candidatos": total,
                "qualidade_coordenada": round(coord / total, 3) if total else None,
            }
        )

    meta = {
        "municipio": MUNICIPIO,
        "ano": ANO,
        "turno": TSE_TURNO,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "fonte": "TSE — Dados Abertos (Eleições Municipais 2024)",
        "bairros": int(len(bairros)),
        "candidatos": len(candidatos_out),
        "secoes_total": geo_stats["secoes_total"],
        "secoes_com_coordenada": geo_stats["secoes_com_coordenada"],
        "secoes_mapeadas": geo_stats["secoes_mapeadas"],
        "secoes_por_coordenada": geo_stats["secoes_por_coordenada"],
        "secoes_por_nome": geo_stats["secoes_por_nome"],
        "secoes_sem_bairro": geo_stats["secoes_sem_bairro"],
        "locais_distintos": geo_stats["locais_distintos"],
        "votos_total": total_votos,
        "votos_candidatos": total_cand,
        "votos_atribuidos_bairro": atribuidos,
        "cobertura_votos": round(atribuidos / total_cand, 4) if total_cand else 0,
        "max_votos_bairro": max_votos_bairro,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    candidatos_doc = {"meta": meta, "cargos": cargos}
    votos_doc = {"meta": meta, "bairros": bairros_out, "por_candidato": votos_por_candidato}

    _write(DATA_DIR / "candidatos.json", candidatos_doc)
    _write(DATA_DIR / "votos.json", votos_doc)
    return meta


def _write(path, doc) -> None:
    path.write_text(
        json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"  {path.name}: {path.stat().st_size / 1e6:.2f} MB")
