import argparse
import sys

from .sources.bairros import fetch_bairros


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ssa-etl", description="ETL do mapa eleitoral de Salvador 2024")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_bairros = sub.add_parser("bairros", help="Baixa os polígonos dos bairros (GeoJSON)")
    p_bairros.add_argument("--force", action="store_true", help="Ignora o cache")

    args = parser.parse_args(argv)

    if args.cmd == "bairros":
        data = fetch_bairros(force=args.force)
        print(f"bairros: {data['properties']['total']} polígonos salvos em web/public/geo/bairros.geojson")
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
