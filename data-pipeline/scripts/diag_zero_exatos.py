import json

from ssa_etl.geo import load_bairros, load_locais, norm

bairros = load_bairros()
sections, _ = load_locais(bairros)
doc = json.load(open("../web/public/data/votos.json", encoding="utf-8"))
zero_ids = {item["id"] for item in doc["bairros"] if item["votos_candidatos"] == 0}
zero = bairros[bairros["bairro_id"].isin(zero_ids)].copy()

print("Bairros zero e seções com NM_BAIRRO exato (nome oficial):")
for _, row in zero.sort_values("nome").iterrows():
    bid = int(row["bairro_id"])
    nome = row["nome"]
    exact = sections[sections["NM_BAIRRO"].map(norm) == norm(nome)]
    if len(exact):
        print(f"\n{bid} {nome}: {len(exact)} seções exatas")
        print(exact[["NR_ZONA", "NR_SECAO", "NM_BAIRRO", "bairro_espacial", "bairro_id", "origem"]].to_string(index=False))
    else:
        print(f"{bid} {nome}: 0 seções com nome exato")

print("\nNM_BAIRRO TSE que não estão no GeoJSON e não estão nos aliases, por seções:")
official = {norm(n) for n in bairros["nome"]}
counts = sections[~sections["NM_BAIRRO"].map(norm).isin(official)]["NM_BAIRRO"].fillna("<vazio>").value_counts()
print(counts.to_string())
