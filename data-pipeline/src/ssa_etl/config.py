from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

CACHE_DIR = ROOT / "data-pipeline" / "cache"
WEB_PUBLIC = ROOT / "web" / "public"
GEO_DIR = WEB_PUBLIC / "geo"
DATA_DIR = WEB_PUBLIC / "data"

MUNICIPIO = "Salvador"
CD_MUNICIPIO_IBGE = "2927408"
UF = "BA"
ANO = 2024

TSE_ELEICAO_ID = "2045202024"
TSE_TURNO = 1

ARCGIS_BAIRROS_URL = (
    "https://services6.arcgis.com/GP5qdNaePRPh2SdT/ArcGIS/rest/services/"
    "Bairros_Dec32791_20_Vigente/FeatureServer/0/query"
)

TSE_CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele"

USER_AGENT = "ssa-map-etl/0.1 (+https://github.com/amrc-lima/ssa-map)"
