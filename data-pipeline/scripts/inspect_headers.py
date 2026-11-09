from pathlib import Path

from ssa_etl.sources.tse import csv_files

targets = {
    "consulta_cand": "consulta_cand_2024_BA.csv",
    "votacao_secao_ba": "votacao_secao_2024_BA.csv",
    "locais_votacao": "eleitorado_local_votacao_2024.csv",
}

for name, filename in targets.items():
    path = next(p for p in csv_files(name) if p.name == filename)
    with path.open(encoding="latin-1", newline="") as fh:
        header = fh.readline().rstrip("\r\n").split(";")
        first = fh.readline().rstrip("\r\n").split(";")
    print(f"== {filename} ({len(header)} colunas)")
    for i, col in enumerate(header):
        value = first[i] if i < len(first) else ""
        print(f"  [{i:>2}] {col:<28} = {value}")
    print()
