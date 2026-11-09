import collections
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "historico" / "partidos"

CORES_RE = re.compile(r'"cores"\s*:\s*\{\s*"wt"\s*:\s*"(.*?)(?<!\\)"', re.S)
HEX_RE = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b")
COLOR_RE = re.compile(r"background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\)|[a-zA-Z]+)")
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.S)

NEUTRAL = {
    "#fff", "#ffffff", "#000", "#000000", "#f8f9fa", "#f8f8ff", "#fffce8", "#f5fffa",
    "#cfc", "#c8ccd1", "#1f1f23", "#36c", "#ddddff", "#9f9fff", "#d0b0ff", "#9070c0",
    "#a5e085", "#75c045", "#a7c1e6", "#5b8dd6", "#ffbd7f", "#ff9d42", "#b9b9b9", "#868686",
    "#ffe16a", "transparent", "none", "white", "var", "#f5f5f5", "#dcdcdc", "#dddddd",
    "#e3e3e3", "#bfbfbf", "#fcfcfc", "#ffcccc", "#ffdead", "#cee0f2", "#cee6f2",
    "#cef2f2", "#cef2ce", "#ffcbdb", "#cf7676", "#bfa3a3", "#d8ffd8",
}


def unescape_all(text: str) -> str:
    previous = None
    for _ in range(4):
        if text == previous:
            break
        previous = text
        text = html.unescape(text)
    return text


for path in sorted(ROOT.glob("*.htm")):
    raw = unescape_all(path.read_text(encoding="utf-8", errors="ignore"))
    title_match = TITLE_RE.search(raw)
    title = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", title_match.group(1))).strip() if title_match else path.stem

    cores_match = CORES_RE.search(raw)
    cores = re.sub(r"<[^>]+>", " ", cores_match.group(1)) if cores_match else ""
    cores = re.sub(r"\s+", " ", cores).strip()
    cores_hex = HEX_RE.findall(cores)

    colors = collections.Counter(COLOR_RE.findall(raw))
    relevant = [
        (color.lower(), count)
        for color, count in colors.most_common()
        if color.lower() not in NEUTRAL
        and not color.lower().startswith(("rgba", "url", "linear", "left"))
    ]

    print("=" * 100)
    print(title.replace(" – Wikipédia, a enciclopédia livre", ""))
    print("cores:", cores[:500])
    print("cores_hex:", cores_hex[:10])
    print("top:", relevant[:8])
