import re
from pathlib import Path

path = Path("../historico/Eleição municipal em Salvador em 2024 – Wikipédia, a enciclopédia livre.htm")
raw = path.read_text(encoding="utf-8", errors="ignore")
print("tamanho", len(raw))
for term in ["Cores", "cores", "Colorbox", "color box", "background-color", "UNIÃO", "União Brasil"]:
    print(term, raw.count(term))

for term in ["background-color", "Colorbox", "color box"]:
    print("\n###", term)
    for match in list(re.finditer(re.escape(term), raw))[:10]:
        start = max(0, match.start() - 250)
        end = min(len(raw), match.end() + 350)
        chunk = raw[start:end]
        plain = re.sub(r"<[^>]+>", " ", chunk)
        plain = re.sub(r"\s+", " ", plain).strip()
        print("---")
        print(plain[:600])
