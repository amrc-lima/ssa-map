import re
from pathlib import Path

path = Path("../historico/Eleição municipal em Salvador em 2024 – Wikipédia, a enciclopédia livre.htm")
raw = path.read_text(encoding="utf-8", errors="ignore")
for term in ["União Brasil", "UNIÃO", "Bruno Reis", "Vereadores eleitos", "Câmara Municipal"]:
    print("\n###", term)
    matches = list(re.finditer(re.escape(term), raw))
    print("ocorrencias", len(matches))
    for match in matches[:5]:
        start = max(0, match.start() - 400)
        end = min(len(raw), match.end() + 700)
        chunk = raw[start:end]
        plain = re.sub(r"<[^>]+>", " ", chunk)
        plain = re.sub(r"\s+", " ", plain).strip()
        print("---")
        print(plain[:900])
