import json

from ssa_etl.geo import load_bairros, load_locais

bairros = load_bairros()
sections, stats = load_locais(bairros)
print(stats)
print(sections[sections["origem"] == "nome_prioritario"][["NM_BAIRRO", "bairro_id", "bairro_oficial"]].value_counts().to_string())
doc = json.load(open("../web/public/data/votos.json", encoding="utf-8"))
zero = [item for item in doc["bairros"] if item["votos_candidatos"] == 0]
print("zero bairros", len(zero))
print(", ".join(f"{item['id']}:{item['nome']}" for item in zero))
