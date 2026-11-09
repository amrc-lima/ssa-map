import hashlib
import json
from datetime import datetime, timezone

import pandas as pd

from .config import ANO, CACHE_DIR, DATA_DIR, MUNICIPIO, TSE_TURNO
from .geo import load_bairros, load_candidatos, load_locais

DERIVED = CACHE_DIR / "derived"
VOTACAO_PATH = DERIVED / "votacao_salvador.csv.gz"

PARTY_COLORS = {
    "PT": "#c0122d",
    "PSD": "#ffa300",
    "UNIÃO": "#00a0df",
    "PL": "#30306c",
    "PP": "#54b8ea",
    "REPUBLICANOS": "#005ca9",
    "MDB": "#009959",
    "PDT": "#e70641",
    "PSB": "#ecdb00",
    "PSDB": "#0f2bc5",
    "NOVO": "#ed7021",
    "PODE": "#00d663",
    "SOLIDARIEDADE": "#f6af04",
    "AVANTE": "#ed5f36",
    "PRTB": "#0047ab",
    "PCO": "#ce1920",
    "PSTU": "#c92127",
    "PCB": "#a8231c",
    "PSOL": "#68018d",
    "REDE": "#3ca08c",
    "CIDADANIA": "#ec008c",
    "DC": "#c89721",
    "PMB": "#8d6e63",
    "PRD": "#007c3c",
    "MOBILIZA": "#da010a",
    "PC do B": "#800314",
    "UP": "#212121",
    "PMN": "#fdd835",
    "AGIR": "#0033a1",
    "PV": "#01652f",
}


def party_color(sigla: str) -> str:
    if sigla in PARTY_COLORS:
        return PARTY_COLORS[sigla]
    hue = int(hashlib.md5(sigla.encode("utf-8")).hexdigest(), 16) % 360
    return f"hsl({hue}, 62%, 42%)"


def _fmt_int(value: int) -> str:
    return f"{value:,}".replace(",", ".")


def _federacao_sigla(value: str) -> str:
    parts = []
    for part in str(value).split("/"):
        part = part.strip()
        if "-" in part:
            part = part.split("-", 1)[1]
        parts.append(part)
    return "/".join(parts)


def _quociente_eleitoral(validos: int, cadeiras: int) -> int:
    if cadeiras <= 0:
        return 0
    quociente = validos / cadeiras
    inteiro = int(quociente)
    return inteiro + 1 if quociente - inteiro > 0.5 else inteiro


def _agremiacoes(cand_meta: pd.DataFrame) -> pd.DataFrame:
    meta = cand_meta.copy()
    meta["agremiacao_key"] = meta["SG_PARTIDO"]
    meta["agremiacao_sigla"] = meta["SG_PARTIDO"]
    meta["agremiacao_nome"] = meta["NM_PARTIDO"]
    meta["agremiacao_tipo"] = "PARTIDO"

    federacao = meta["TP_AGREMIACAO"].eq("FEDERAÇÃO") & ~meta[
        "SG_FEDERACAO"
    ].isin(["#NULO", "-1", ""])
    meta.loc[federacao, "agremiacao_key"] = meta.loc[federacao, "SG_FEDERACAO"]
    meta.loc[federacao, "agremiacao_sigla"] = meta.loc[
        federacao, "SG_FEDERACAO"
    ].map(_federacao_sigla)
    meta.loc[federacao, "agremiacao_nome"] = meta.loc[federacao, "NM_FEDERACAO"]
    meta.loc[federacao, "agremiacao_tipo"] = "FEDERAÇÃO"
    return meta


def _status_candidato(
    cargo_id: str,
    resultado: str,
    votos: int,
    agremiacao_nome: str,
    agremiacao_tipo: str,
    agremiacao_votos: int,
    agremiacao_qp: int,
    quociente: int,
    limite_10: int,
) -> dict:
    eleito = str(resultado).startswith("ELEITO")
    suplente = resultado == "SUPLENTE"

    if cargo_id != "13":
        return {
            "status": "eleito" if eleito else "nao_eleito",
            "status_label": "Eleito" if eleito else "Não eleito",
            "status_detalhe": f"{_fmt_int(votos)} votos no 1º turno",
            "eleito": eleito,
            "suplente": suplente,
            "eleito_por": None,
        }

    sujeito = "a federação" if agremiacao_tipo == "FEDERAÇÃO" else "o partido"
    coeficiente = "da federação" if agremiacao_tipo == "FEDERAÇÃO" else "do partido"

    if eleito:
        if votos >= quociente:
            status = "eleito_proprios"
            status_label = "Eleito com votos próprios"
            status_detalhe = f"{_fmt_int(votos)} votos ≥ QE {_fmt_int(quociente)}"
        else:
            status = "eleito_coeficiente"
            status_label = f"Eleito com votos do coeficiente eleitoral {coeficiente}"
            if "MÉDIA" in str(resultado):
                status_detalhe = (
                    f"{_fmt_int(votos)} votos < QE {_fmt_int(quociente)}; "
                    f"{agremiacao_nome} somou {_fmt_int(agremiacao_votos)} votos "
                    f"(QP {agremiacao_qp}) e o candidato foi eleito por média"
                )
            else:
                status_detalhe = (
                    f"{_fmt_int(votos)} votos < QE {_fmt_int(quociente)}; "
                    f"{agremiacao_nome} somou {_fmt_int(agremiacao_votos)} votos "
                    f"(QP {agremiacao_qp}) e o candidato ficou entre os eleitos"
                )
        eleito_por = (
            "MÉDIA" if "MÉDIA" in str(resultado) else "QP" if "QP" in str(resultado) else resultado
        )
    else:
        eleito_por = None
        if votos * 10 < quociente:
            status = "nao_eleito_10"
            status_label = "Não eleito — abaixo de 10% do coeficiente eleitoral"
            status_detalhe = (
                f"{_fmt_int(votos)} votos < piso de {_fmt_int(limite_10)} "
                f"(10% do QE {_fmt_int(quociente)})"
            )
            if agremiacao_votos < quociente:
                status_detalhe += (
                    f"; {agremiacao_nome} também ficou abaixo do QE "
                    f"({_fmt_int(agremiacao_votos)} votos)"
                )
        elif agremiacao_votos < quociente:
            status = "nao_eleito_partido"
            status_label = f"Não eleito — {sujeito} não atingiu o coeficiente eleitoral"
            status_detalhe = (
                f"{_fmt_int(votos)} votos ≥ piso de {_fmt_int(limite_10)}, mas "
                f"{agremiacao_nome} somou {_fmt_int(agremiacao_votos)} votos "
                f"< QE {_fmt_int(quociente)}"
            )
        else:
            status = "nao_eleito"
            status_label = "Não eleito" + (" (suplente)" if suplente else "")
            status_detalhe = (
                f"{_fmt_int(votos)} votos; {agremiacao_nome} somou "
                f"{_fmt_int(agremiacao_votos)} votos (QP {agremiacao_qp}), "
                "mas o candidato não ficou entre os eleitos"
            )
            if suplente:
                status_detalhe += " — suplente"

    return {
        "status": status,
        "status_label": status_label,
        "status_detalhe": status_detalhe,
        "eleito": eleito,
        "suplente": suplente,
        "eleito_por": eleito_por,
    }


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
    cand_meta = _agremiacoes(load_candidatos())
    vot = _load_votacao()

    print(
        "geo:",
        f"{geo_stats['secoes_mapeadas']}/{geo_stats['secoes_total']} seções mapeadas",
        f"({geo_stats['secoes_por_alias']} por alias, "
        f"{geo_stats['secoes_por_nome_prioritario']} por nome prioritário, "
        f"{geo_stats['secoes_por_coordenada']} por coordenada, "
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

    vot["NR_VOTAVEL"] = vot["NR_VOTAVEL"].astype(str).str.strip()
    numero_para_sigla = (
        cand_meta.drop_duplicates(subset=["NR_PARTIDO"])
        .set_index("NR_PARTIDO")["SG_PARTIDO"]
        .to_dict()
    )
    legenda_mask = (
        (sq <= 0)
        & vot["CD_CARGO"].eq("13")
        & vot["NR_VOTAVEL"].str.fullmatch(r"\d{2}")
        & vot["NR_VOTAVEL"].isin(numero_para_sigla)
    )
    legenda = vot[legenda_mask].copy()
    legenda["partido"] = legenda["NR_VOTAVEL"].map(numero_para_sigla)
    legenda_total = {
        str(partido): int(qtd)
        for partido, qtd in legenda.groupby("partido")["QT_VOTOS"].sum().items()
    }
    legenda_mapa = (
        legenda.dropna(subset=["bairro_id"])
        .groupby(["partido", "bairro_id"], as_index=False)["QT_VOTOS"]
        .sum()
    )
    legenda_por_partido: dict[str, dict[str, int]] = {}
    for partido, grupo in legenda_mapa.groupby("partido"):
        legenda_por_partido[str(partido)] = {
            str(int(bid)): int(qtd)
            for bid, qtd in zip(grupo["bairro_id"], grupo["QT_VOTOS"])
        }
    legenda_mapeada = int(legenda.dropna(subset=["bairro_id"])["QT_VOTOS"].sum())
    print(
        f"legenda: {int(legenda['QT_VOTOS'].sum()):,} votos "
        f"({legenda_mapeada:,} atribuídos a bairros)"
    )

    agg = (
        candidatos.dropna(subset=["bairro_id"])
        .groupby(["SQ_CANDIDATO", "bairro_id"], as_index=False)["QT_VOTOS"]
        .sum()
    )
    totais = candidatos.groupby("SQ_CANDIDATO")["QT_VOTOS"].sum().to_dict()

    vereador_meta = cand_meta[
        (cand_meta["CD_CARGO"] == "13") & (cand_meta["DS_SIT_TOT_TURNO"] != "#NULO")
    ].copy()
    cadeiras_vereador = int(
        vereador_meta["DS_SIT_TOT_TURNO"].str.startswith("ELEITO").sum()
    )
    ids_vereador = set(vereador_meta["SQ_CANDIDATO"])
    votos_validos_vereador = sum(
        qtd for sq_id, qtd in totais.items() if sq_id in ids_vereador
    ) + sum(legenda_total.values())
    quociente = _quociente_eleitoral(votos_validos_vereador, cadeiras_vereador)
    limite_10 = (quociente + 9) // 10

    partido_para_agremiacao = (
        vereador_meta.drop_duplicates(subset=["SG_PARTIDO"])
        .set_index("SG_PARTIDO")["agremiacao_key"]
        .to_dict()
    )
    legenda["agremiacao_key"] = legenda["partido"].map(partido_para_agremiacao)
    sem_agremiacao = legenda[legenda["agremiacao_key"].isna()]
    if len(sem_agremiacao):
        print(
            f"aviso: {int(sem_agremiacao['QT_VOTOS'].sum()):,} votos de legenda "
            "sem agremiação"
        )
    legenda_agremiacao = (
        legenda.dropna(subset=["agremiacao_key"])
        .groupby("agremiacao_key")["QT_VOTOS"]
        .sum()
    )

    candidatos_vereador = candidatos[candidatos["CD_CARGO"] == "13"].copy()
    sq_para_agremiacao = cand_meta.set_index("SQ_CANDIDATO")["agremiacao_key"].to_dict()
    candidatos_vereador["agremiacao_key"] = candidatos_vereador["SQ_CANDIDATO"].map(
        sq_para_agremiacao
    )
    agremiacao_votos = (
        candidatos_vereador.groupby("agremiacao_key")["QT_VOTOS"]
        .sum()
        .add(legenda_agremiacao, fill_value=0)
        .astype("int64")
    )
    agremiacao_qp = (
        (agremiacao_votos // quociente).astype(int)
        if quociente > 0
        else agremiacao_votos * 0
    )

    print(
        f"vereador: {votos_validos_vereador:,} votos válidos, "
        f"{cadeiras_vereador} cadeiras, QE {quociente:,}, piso de 10% {limite_10:,}"
    )
    if int(agremiacao_votos.sum()) != votos_validos_vereador:
        print(
            f"aviso: soma das agremiações ({int(agremiacao_votos.sum()):,}) "
            f"difere dos votos válidos ({votos_validos_vereador:,})"
        )

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
        votos = int(totais[candidato_id])
        agremiacao_votos_cand = int(agremiacao_votos.get(row["agremiacao_key"], 0))
        agremiacao_qp_cand = int(agremiacao_qp.get(row["agremiacao_key"], 0))
        status = _status_candidato(
            row["CD_CARGO"],
            row["DS_SIT_TOT_TURNO"],
            votos,
            row["agremiacao_nome"],
            row["agremiacao_tipo"],
            agremiacao_votos_cand,
            agremiacao_qp_cand,
            quociente,
            limite_10,
        )
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
                "agremiacao": row["agremiacao_sigla"],
                "agremiacao_nome": row["agremiacao_nome"],
                "agremiacao_tipo": row["agremiacao_tipo"],
                "agremiacao_votos": (
                    agremiacao_votos_cand if row["CD_CARGO"] == "13" else None
                ),
                "agremiacao_qp": agremiacao_qp_cand if row["CD_CARGO"] == "13" else None,
                "coeficiente": quociente if row["CD_CARGO"] == "13" else None,
                "limite_10": limite_10 if row["CD_CARGO"] == "13" else None,
                "cor": party_color(row["SG_PARTIDO"]),
                "situacao": row["DS_SITUACAO_CANDIDATURA"],
                "resultado": row["DS_SIT_TOT_TURNO"],
                **status,
                "votos_total": votos,
                "votos_max_bairro": int(max(bairros_votos.values())) if bairros_votos else 0,
                "bairros_com_voto": len(bairros_votos),
            }
        )

    cargos = []
    cargo_ids = sorted(
        {item["cargo_id"] for item in candidatos_out},
        key=lambda cargo_id: {"11": 0, "13": 1}.get(cargo_id, 9),
    )
    for cargo_id in cargo_ids:
        grupo = [item for item in candidatos_out if item["cargo_id"] == cargo_id]
        grupo.sort(key=lambda item: (-item["votos_total"], item["nome_urna"]))
        cargos.append(
            {
                "id": str(cargo_id),
                "nome": grupo[0]["cargo"],
                "candidatos": grupo,
            }
        )

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
        "secoes_por_alias": geo_stats["secoes_por_alias"],
        "secoes_por_nome_prioritario": geo_stats["secoes_por_nome_prioritario"],
        "secoes_por_coordenada": geo_stats["secoes_por_coordenada"],
        "secoes_por_nome": geo_stats["secoes_por_nome"],
        "secoes_sem_bairro": geo_stats["secoes_sem_bairro"],
        "locais_distintos": geo_stats["locais_distintos"],
        "votos_total": total_votos,
        "votos_candidatos": total_cand,
        "votos_legenda": int(legenda["QT_VOTOS"].sum()),
        "votos_legenda_bairro": legenda_mapeada,
        "votos_atribuidos_bairro": atribuidos,
        "cobertura_votos": round(atribuidos / total_cand, 4) if total_cand else 0,
        "max_votos_bairro": max_votos_bairro,
        "cadeiras_vereador": cadeiras_vereador,
        "votos_validos_vereador": votos_validos_vereador,
        "coeficiente_eleitoral": quociente,
        "limite_10_coeficiente": limite_10,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    candidatos_doc = {"meta": meta, "cargos": cargos}
    votos_doc = {
        "meta": meta,
        "bairros": bairros_out,
        "por_candidato": votos_por_candidato,
        "legenda": legenda_por_partido,
        "legenda_total": legenda_total,
    }

    _write(DATA_DIR / "candidatos.json", candidatos_doc)
    _write(DATA_DIR / "votos.json", votos_doc)
    return meta


def _write(path, doc) -> None:
    path.write_text(
        json.dumps(doc, ensure_ascii=False, separators=(",", ":"), allow_nan=False),
        encoding="utf-8",
    )
    print(f"  {path.name}: {path.stat().st_size / 1e6:.2f} MB")
