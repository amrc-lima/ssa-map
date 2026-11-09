from ssa_etl.sources.tse import RESOURCES, extract

for name in RESOURCES:
    out_dir = extract(name)
    print(f"== {name} -> {out_dir}")
    for path in sorted(out_dir.rglob("*.csv")):
        print(f"   {path.name}  ({path.stat().st_size / 1e6:.1f} MB)")
