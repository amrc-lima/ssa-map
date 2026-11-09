from pathlib import Path
import zipfile

from ..cache import Cache
from ..config import CACHE_DIR, TSE_CDN

RESOURCES = {
    "consulta_cand": f"{TSE_CDN}/consulta_cand/consulta_cand_2024.zip",
    "votacao_secao_ba": f"{TSE_CDN}/votacao_secao/votacao_secao_2024_BA.zip",
    "locais_votacao": f"{TSE_CDN}/eleitorado_locais_votacao/eleitorado_local_votacao_2024.zip",
}

EXTRACT_DIR = CACHE_DIR / "extracted"


def download(name: str, force: bool = False) -> Path:
    if name not in RESOURCES:
        raise KeyError(f"Recurso TSE desconhecido: {name}")
    return Cache().download(RESOURCES[name], force=force)


def extract(name: str, force: bool = False) -> Path:
    out_dir = EXTRACT_DIR / name
    if out_dir.exists() and any(out_dir.iterdir()) and not force:
        return out_dir
    zip_path = download(name, force=force)
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(out_dir)
    return out_dir


def csv_files(name: str) -> list[Path]:
    return sorted(extract(name).rglob("*.csv"))
