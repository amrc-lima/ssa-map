import json
from collections import defaultdict

doc = json.load(open("web/public/data/candidatos.json", encoding="utf-8"))
for cargo in doc["cargos"]:
    print("==", cargo["nome"])
    partidos: dict[tuple[str, str, str], list[int]] = defaultdict(lambda: [0, 0])
    for candidato in cargo["candidatos"]:
        key = (candidato["partido"], candidato["partido_nome"], candidato["partido_numero"])
        partidos[key][0] += 1
        partidos[key][1] += candidato["votos_total"]
    for (sigla, nome, numero), (qtd, votos) in sorted(partidos.items(), key=lambda kv: kv[0][0]):
        print(f"{sigla:14} {numero:>2} {votos:>9,} votos  {qtd:>3} cand  {nome}")
    print()
