import html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "historico" / "partidos"
for name in [
    "Agir (Brasil) – Wikipédia, a enciclopédia livre.htm",
    "Partido dos Trabalhadores – Wikipédia, a enciclopédia livre.htm",
    "Partido Democrático Trabalhista – Wikipédia, a enciclopédia livre.htm",
]:
    path = ROOT / name
    raw = path.read_text(encoding="utf-8", errors="ignore")
    for _ in range(4):
        raw = html.unescape(raw)
    print("=" * 100)
    print(name)
    start = 0
    for index in range(5):
        pos = raw.find('"cores"', start)
        if pos < 0:
            break
        print("--- pos", pos)
        print(raw[max(0, pos - 150): pos + 400])
        start = pos + 1
