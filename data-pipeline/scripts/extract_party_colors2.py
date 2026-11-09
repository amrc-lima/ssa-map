import collections
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "historico" / "partidos"

WT_RE = re.compile(r'"wt"\s*:\s*"(.*?)(?<!\\)"', re.S)
HEX_RE = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b")
COLOR_RE = re.compile(r"background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\)|[a-zA-Z]+)")

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
    title_match = re.search(r"<title>(.*?)</title>", raw, re.S)
    title = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", title_match.group(1))).strip() if title_match else path.stem

    cores_values = []
    for match in re.finditer(r'"cores"\s*:\s*\{\s*"wt"\s*:\s*"', raw):
        rest = raw[match.end():]
        value_match = WT_RE.search(rest)
        if value_match:
            cores_values.append(value_match.group(1))

    colors = collections.Counter(COLOR_RE.findall(raw))
    relevant = [
        (color.lower(), count)
        for color, count in colors.most_common()
        if color.lower() not in NEUTRAL and not color.lower().startswith(("rgba", "url", "linear"))
    ]

    print("=" * 100)
    print(title.replace(" – Wikipédia, a enciclopédia livre", ""))
    print("top:", relevant[:8])
    for value in cores_values[:3]:
        clean = re.sub(r"<[^>]+>", " ", value)
        clean = re.sub(r"\s+", " ", clean).strip()
        print("cores:", clean[:400])
        print("hex:", HEX_RE.findall(value)[:10])
