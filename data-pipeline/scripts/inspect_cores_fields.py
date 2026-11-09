import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "historico" / "partidos"


def show(path: Path, term: str = '"cores"', radius: int = 600) -> None:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    print("=" * 100)
    print(path.name)
    for match in list(re.finditer(re.escape(term), raw))[:2]:
        chunk = raw[max(0, match.start() - radius): match.start() + radius]
        chunk = html.unescape(chunk)
        chunk = re.sub(r"<[^>]+>", " ", chunk)
        chunk = re.sub(r"\s+", " ", chunk).strip()
        print(chunk[:1200])


for name in [
    "Partido Democrático Trabalhista – Wikipédia, a enciclopédia livre.htm",
    "Partido Social Democrático (2011) – Wikipédia, a enciclopédia livre.htm",
    "Progressistas – Wikipédia, a enciclopédia livre.htm",
    "Partido Socialista Brasileiro (1985) – Wikipédia, a enciclopédia livre.htm",
    "União Brasil – Wikipédia, a enciclopédia livre.htm",
    "Partido Socialismo e Liberdade – Wikipédia, a enciclopédia livre.htm",
    "Partido dos Trabalhadores – Wikipédia, a enciclopédia livre.htm",
]:
    path = ROOT / name
    if not path.exists():
        print("não encontrado", name)
        continue
    show(path)
