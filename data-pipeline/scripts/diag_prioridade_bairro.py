import pandas as pd

from ssa_etl.geo import load_bairros, load_locais

bairros = load_bairros()
sections, stats = load_locais(bairros)
both = sections[sections["bairro_espacial"].notna() & sections["bairro_nome"].notna()]
print("seções com nome e coordenada:", len(both))
print("concordam:", int((both["bairro_espacial"] == both["bairro_nome"]).sum()))
print("discordam:", int((both["bairro_espacial"] != both["bairro_nome"]).sum()))

old = sections["bairro_espacial"].fillna(sections["bairro_nome"])
new = sections["bairro_nome"].fillna(sections["bairro_espacial"])
moved = sections[old != new]
print("\nseções que mudam com prioridade nome:", len(moved))
print(moved[["NR_ZONA", "NR_SECAO", "NM_BAIRRO", "bairro_espacial", "bairro_nome"]].head(40).to_string(index=False))

for label, ids in [("ANTES", old), ("DEPOIS", new)]:
    counts = ids.value_counts()
    zero_ids = sorted(set(bairros["bairro_id"].astype(int)) - set(counts.index.astype(int)))
    print(f"\n{label}: bairros zero = {len(zero_ids)}")
    nomes = bairros.set_index("bairro_id")["nome"]
    print(", ".join(f"{i}:{nomes.get(i)}" for i in zero_ids))

print("\nBairros que perdem seções com a prioridade nome (top 30):")
old_counts = old.value_counts()
new_counts = new.value_counts()
delta = (new_counts.reindex(old_counts.index, fill_value=0) - old_counts).sort_values()
nomes = bairros.set_index("bairro_id")["nome"]
for bid, d in delta.head(30).items():
    if d != 0:
        print(f"  {int(bid):3d} {nomes.get(int(bid), '?'):<35} {int(d):+d}")

print("\nBairros que ganham seções com a prioridade nome (top 30):")
for bid, d in delta.tail(30)[::-1].items():
    if d != 0:
        print(f"  {int(bid):3d} {nomes.get(int(bid), '?'):<35} {int(d):+d}")
