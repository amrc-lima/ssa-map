import json
from urllib.parse import urlencode

from ..cache import Cache
from ..config import ARCGIS_BAIRROS_URL, GEO_DIR, MUNICIPIO

FIELDS_QUERY = {
    "where": "1=1",
    "outFields": "*",
    "returnGeometry": "true",
    "outSR": "4326",
    "f": "geojson",
}


def fetch_bairros(force: bool = False) -> dict:
    """Baixa os polígonos oficiais dos bairros de Salvador (ArcGIS, EPSG:4326)."""
    url = f"{ARCGIS_BAIRROS_URL}?{urlencode(FIELDS_QUERY)}"
    raw = Cache().get_bytes(url, force=force)
    data = json.loads(raw)

    if data.get("type") != "FeatureCollection":
        raise RuntimeError(f"Resposta inesperada do ArcGIS: {data.get('type')!r}")

    features = []
    for feat in data.get("features", []):
        props = feat.get("properties") or {}
        nome = (props.get("NOME_BAIRR") or props.get("NM_BAIRRO") or "").strip()
        fid = props.get("FID", props.get("OBJECTID"))
        features.append(
            {
                "type": "Feature",
                "properties": {"id": fid, "nome": nome},
                "geometry": feat.get("geometry"),
            }
        )

    if not features:
        raise RuntimeError("Nenhum bairro retornado pelo ArcGIS")

    out = {
        "type": "FeatureCollection",
        "properties": {
            "municipio": MUNICIPIO,
            "fonte": "Prefeitura de Salvador — Bairros_Dec32791_20_Vigente (ArcGIS)",
            "srs": "EPSG:4326",
            "total": len(features),
        },
        "features": features,
    }

    GEO_DIR.mkdir(parents=True, exist_ok=True)
    (GEO_DIR / "bairros.geojson").write_text(
        json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    return out
