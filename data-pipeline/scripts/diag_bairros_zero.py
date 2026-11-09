import pandas as pd

from ssa_etl.geo import load_bairros, load_locais, norm

bairros = load_bairros()
sections, stats = load_locais(bairros)
print(stats)
print("\ncolunas:", list(sections.columns))
print("\namostra:")
print(sections[["NR_ZONA", "NR_SECAO", "NR_LOCAL_VOTACAO", "NM_BAIRRO", "bairro_espacial", "bairro_nome", "bairro_id", "origem"]].head(20).to_string())

zero_ids = [6, 9, 12, 13, 15, 17, 18, 21, 31, 32, 36, 53, 56, 65, 66, 69, 73, 75, 98, 103, 113, 117, 119, 124, 125, 130, 133, 135, 136, 138, 141, 147, 149, 155, 156, 158, 159, 162, 166, 169]
zero = bairros[bairros["bairro_id"].isin(zero_ids)]
print("\nbairros com zero votos (oficiais):")
print(zero[["bairro_id", "nome"]].to_string(index=False))

by_id = sections.groupby("bairro_id").size()
print("\nseções atribuídas aos bairros zero:")
for _, row in zero.iterrows():
    bid = int(row["bairro_id"])
    n = int(by_id.get(bid, 0))
    print(f"  {bid:3d} {row['nome']:<35} seções={n}")

print("\nseções sem bairro por NM_BAIRRO (top 40):")
sem = sections[sections["bairro_id"].isna()]
print(sem["NM_BAIRRO"].fillna("<vazio>").value_counts().head(40).to_string())

print("\nNomes TSE que normalizam para bairros zero:")
zero_norm = {norm(nome): bid for bid, nome in zip(zero["bairro_id"], zero["nome"])}
tse_names = sections["NM_BAIRRO"].dropna().unique()
for name in sorted(tse_names):
    n = norm(name)
    if n in zero_norm:
        subset = sections[sections["NM_BAIRRO"] == name]
        print(f"  {name!r} -> bairro_id oficial {zero_norm[n]} | seções={len(subset)} | atribuídas={subset['bairro_id'].notna().sum()} | ids={sorted(set(subset['bairro_id'].dropna().astype(int)))}")

print("\nNomes oficiais zero que NÃO aparecem em NM_BAIRRO do TSE:")
for _, row in zero.iterrows():
    if norm(row["nome"]) not in {norm(x) for x in tse_names}:
        print(f"  {row['bairro_id']} {row['nome']}")

print("\nTop bairros por seções atribuídas:")
print(sections.groupby("bairro_id").size().sort_values(ascending=False).head(20).to_string())
