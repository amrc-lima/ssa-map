import hashlib
import json
from pathlib import Path

import requests

from .config import CACHE_DIR, USER_AGENT


class Cache:
    """Cache HTTP em disco, com metadados de auditoria (sha256/tamanho)."""

    def __init__(self, root: Path = CACHE_DIR):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})

    def _base(self, url: str) -> Path:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
        return self.root / digest

    def get_bytes(self, url: str, force: bool = False) -> bytes:
        data_path = self._base(url).with_suffix(".bin")
        if data_path.exists() and not force:
            return data_path.read_bytes()
        resp = self.session.get(url, timeout=120)
        resp.raise_for_status()
        data_path.write_bytes(resp.content)
        self._write_meta(url, data_path, resp.content)
        return resp.content

    def download(self, url: str, force: bool = False) -> Path:
        data_path = self._base(url).with_suffix(".bin")
        if data_path.exists() and not force:
            return data_path
        with self.session.get(url, timeout=600, stream=True) as resp:
            resp.raise_for_status()
            with open(data_path, "wb") as fh:
                for chunk in resp.iter_content(chunk_size=1 << 20):
                    fh.write(chunk)
        self._write_meta(url, data_path, data_path.read_bytes())
        return data_path

    def _write_meta(self, url: str, data_path: Path, content: bytes) -> None:
        meta = {
            "url": url,
            "size": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
        }
        data_path.with_suffix(".json").write_text(
            json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8"
        )
