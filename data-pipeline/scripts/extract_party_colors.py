import collections
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "historico" / "partidos"

COLOR_RE = re.compile(r"background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\)|[a-zA-Z]+)")
HEX_RE = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b")
CORES_RE = re.compile(r'"cores"\s*:\s*\{\s*"wt"\s*:\s*"(.*?)"\s*\}', re.S)
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.S)

NEUTRAL = {
    "#fff", "#ffffff", "#000", "#000000", "#f8f9fa", "#f8f8ff", "#fffce8", "#f5fffa",
    "#cfc", "#c8ccd1", "#1f1f23", "#36c", "#ddddff", "#9f9fff", "#d0b0ff", "#9070c0",
    "#a5e085", "#75c045", "#a7c1e6", "#5b8dd6", "#ffbd7f", "#ff9d42", "#b9b9b9", "#868686",
    "#ffe16a", "transparent", "none", "white", "var",
}


def clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


for path in sorted(ROOT.glob("*.htm")):
    raw = path.read_text(encoding="utf-8", errors="ignore")
    title = clean(TITLE_RE.search(raw).group(1)) if TITLE_RE.search(raw) else path.stem
    colors = collections.Counter(COLOR_RE.findall(raw))
    relevant = [
        (color.lower(), count)
        for color, count in colors.most_common()
        if color.lower() not in NEUTRAL and not color.lower().startswith("rgba")
    ]
    cores_match = CORES_RE.search(raw)
    cores = clean(cores_match.group(1)) if cores_match else ""
    cores_hex = HEX_RE.findall(cores)
    print("=" * 100)
    print(title.replace(" – Wikipédia, a enciclopédia livre", ""))
    print("top:", relevant[:8])
    print("cores:", cores[:500])
    print("cores_hex:", cores_hex[:10])
