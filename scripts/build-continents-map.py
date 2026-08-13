#!/usr/bin/env python3
"""Build continents / continents-oceans SVGs from Wikimedia BlankMap-World.svg.

Source (CC0 / public domain map data):
  https://upload.wikimedia.org/wikipedia/commons/8/80/BlankMap-World.svg

Usage:
  curl -sL -o /tmp/BlankMap-World.svg \\
    'https://upload.wikimedia.org/wikipedia/commons/8/80/BlankMap-World.svg'
  python3 scripts/build-continents-map.py /tmp/BlankMap-World.svg
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "geography" / "maps"

ISO = {
    "us": "NA",
    "ca": "NA",
    "mx": "NA",
    "gt": "NA",
    "bz": "NA",
    "sv": "NA",
    "hn": "NA",
    "ni": "NA",
    "cr": "NA",
    "pa": "NA",
    "cu": "NA",
    "jm": "NA",
    "ht": "NA",
    "do": "NA",
    "bs": "NA",
    "bb": "NA",
    "tt": "NA",
    "gd": "NA",
    "lc": "NA",
    "vc": "NA",
    "ag": "NA",
    "kn": "NA",
    "dm": "NA",
    "pr": "NA",
    "vi": "NA",
    "vg": "NA",
    "ky": "NA",
    "bm": "NA",
    "tc": "NA",
    "aw": "NA",
    "cw": "NA",
    "sx": "NA",
    "bq": "NA",
    "gl": "NA",
    "pm": "NA",
    "bl": "NA",
    "mf": "NA",
    "gp": "NA",
    "mq": "NA",
    "ai": "NA",
    "ms": "NA",
    "br": "SA",
    "ar": "SA",
    "cl": "SA",
    "pe": "SA",
    "co": "SA",
    "ve": "SA",
    "ec": "SA",
    "bo": "SA",
    "py": "SA",
    "uy": "SA",
    "gy": "SA",
    "sr": "SA",
    "gf": "SA",
    "fk": "SA",
    "gs": "SA",
    "is": "EU",
    "ie": "EU",
    "gb": "EU",
    "pt": "EU",
    "es": "EU",
    "fr": "EU",
    "be": "EU",
    "nl": "EU",
    "lu": "EU",
    "de": "EU",
    "ch": "EU",
    "at": "EU",
    "li": "EU",
    "it": "EU",
    "sm": "EU",
    "va": "EU",
    "mt": "EU",
    "mc": "EU",
    "ad": "EU",
    "pl": "EU",
    "cz": "EU",
    "sk": "EU",
    "hu": "EU",
    "si": "EU",
    "hr": "EU",
    "ba": "EU",
    "rs": "EU",
    "me": "EU",
    "mk": "EU",
    "al": "EU",
    "gr": "EU",
    "bg": "EU",
    "ro": "EU",
    "md": "EU",
    "ua": "EU",
    "by": "EU",
    "lt": "EU",
    "lv": "EU",
    "ee": "EU",
    "fi": "EU",
    "se": "EU",
    "no": "EU",
    "dk": "EU",
    "fo": "EU",
    "ax": "EU",
    "sj": "EU",
    "gg": "EU",
    "je": "EU",
    "im": "EU",
    "gi": "EU",
    "xk": "EU",
    "xr": "EU",
    "ma": "AF",
    "eh": "AF",
    "dz": "AF",
    "tn": "AF",
    "ly": "AF",
    "eg": "AF",
    "sd": "AF",
    "ss": "AF",
    "td": "AF",
    "ne": "AF",
    "ml": "AF",
    "mr": "AF",
    "sn": "AF",
    "gm": "AF",
    "gw": "AF",
    "gn": "AF",
    "sl": "AF",
    "lr": "AF",
    "ci": "AF",
    "gh": "AF",
    "tg": "AF",
    "bj": "AF",
    "ng": "AF",
    "bf": "AF",
    "cm": "AF",
    "gq": "AF",
    "ga": "AF",
    "cg": "AF",
    "cd": "AF",
    "cf": "AF",
    "ao": "AF",
    "zm": "AF",
    "mw": "AF",
    "mz": "AF",
    "zw": "AF",
    "bw": "AF",
    "na": "AF",
    "za": "AF",
    "ls": "AF",
    "sz": "AF",
    "mg": "AF",
    "mu": "AF",
    "sc": "AF",
    "km": "AF",
    "yt": "AF",
    "re": "AF",
    "dj": "AF",
    "er": "AF",
    "et": "AF",
    "so": "AF",
    "ke": "AF",
    "ug": "AF",
    "rw": "AF",
    "bi": "AF",
    "tz": "AF",
    "st": "AF",
    "cv": "AF",
    "sh": "AF",
    "io": "AF",
    "ru": "AS",
    "tr": "AS",
    "cy": "AS",
    "ge": "AS",
    "am": "AS",
    "az": "AS",
    "kz": "AS",
    "uz": "AS",
    "tm": "AS",
    "kg": "AS",
    "tj": "AS",
    "af": "AS",
    "pk": "AS",
    "in": "AS",
    "np": "AS",
    "bt": "AS",
    "bd": "AS",
    "lk": "AS",
    "mv": "AS",
    "cn": "AS",
    "mn": "AS",
    "kp": "AS",
    "kr": "AS",
    "jp": "AS",
    "tw": "AS",
    "hk": "AS",
    "mo": "AS",
    "vn": "AS",
    "la": "AS",
    "kh": "AS",
    "th": "AS",
    "mm": "AS",
    "my": "AS",
    "sg": "AS",
    "bn": "AS",
    "id": "AS",
    "ph": "AS",
    "tl": "AS",
    "ir": "AS",
    "iq": "AS",
    "sy": "AS",
    "lb": "AS",
    "il": "AS",
    "ps": "AS",
    "jo": "AS",
    "sa": "AS",
    "ye": "AS",
    "om": "AS",
    "ae": "AS",
    "qa": "AS",
    "bh": "AS",
    "kw": "AS",
    "au": "OC",
    "nz": "OC",
    "pg": "OC",
    "sb": "OC",
    "vu": "OC",
    "nc": "OC",
    "fj": "OC",
    "to": "OC",
    "ws": "OC",
    "ki": "OC",
    "tv": "OC",
    "nr": "OC",
    "pw": "OC",
    "fm": "OC",
    "mh": "OC",
    "gu": "OC",
    "mp": "OC",
    "as": "OC",
    "ck": "OC",
    "nu": "OC",
    "pf": "OC",
    "wf": "OC",
    "tk": "OC",
    "pn": "OC",
    "aq": "AN",
    "tf": "AN",
    "hm": "AN",
    "bv": "AN",
}

OCEANS = """
  <path id="PO" data-id="PO" class="geo-region geo-ocean" d="M 0,80 L 380,60 L 420,400 L 350,700 L 280,1000 L 200,1200 L 0,1250 Z M 2100,100 L 2754,80 L 2754,1250 L 2400,1200 L 2200,900 L 2150,500 Z"/>
  <path id="AO" data-id="AO" class="geo-region geo-ocean" d="M 700,120 L 1100,100 L 1250,350 L 1200,700 L 1100,1000 L 900,1150 L 720,1000 L 680,600 L 700,300 Z"/>
  <path id="IO" data-id="IO" class="geo-region geo-ocean" d="M 1550,450 L 2000,420 L 2150,650 L 2100,950 L 1800,1050 L 1550,900 L 1500,650 Z"/>
  <path id="AR" data-id="AR" class="geo-region geo-ocean" d="M 400,0 L 2350,0 L 2200,120 L 1800,90 L 1400,110 L 900,80 L 500,100 Z"/>
  <path id="SO" data-id="SO" class="geo-region geo-ocean" d="M 200,1180 L 2550,1180 L 2754,1398 L 0,1398 Z"/>
"""


def continent_from_attrs(tag: str) -> str | None:
    m = re.search(r'\bid="([a-z]{2})-"', tag) or re.search(r'\bid="([a-z]{2})"', tag)
    if m and m.group(1) in ISO:
        return ISO[m.group(1)]
    cm = re.search(r'\bclass="([^"]*)"', tag)
    if cm:
        for tok in reversed(cm.group(1).split()):
            code = tok.rstrip("-")
            if len(code) == 2 and code in ISO:
                return ISO[code]
    return None


def rewrite_open_tag(m: re.Match[str]) -> str:
    tag = m.group(0)
    if "circlexx" in tag or "subxx" in tag or "oceanxx" in tag:
        return tag
    if "landxx" not in tag and "antxx" not in tag:
        return tag
    cont = continent_from_attrs(tag)
    if not cont or "data-id=" in tag:
        return tag
    if 'class="' in tag:
        tag = re.sub(r'class="([^"]*)"', r'class="\1 geo-region"', tag, count=1)
    elif tag.endswith("/>"):
        tag = tag[:-2] + ' class="geo-region"/>'
    else:
        tag = tag[:-1] + ' class="geo-region">'
    if tag.endswith("/>"):
        return tag[:-2] + f' data-id="{cont}"/>'
    return tag[:-1] + f' data-id="{cont}">'


def tag_paths_in_group(text: str, gid: str, cont: str) -> str:
    start = text.find(f'id="{gid}"')
    if start < 0:
        return text
    gstart = text.rfind("<g", 0, start)
    i = text.find(">", gstart) + 1
    depth = 1
    pos = i
    end = None
    while depth and pos < len(text):
        next_open = text.find("<g", pos)
        next_close = text.find("</g>", pos)
        if next_close < 0:
            break
        if next_open >= 0 and next_open < next_close:
            depth += 1
            pos = next_open + 2
        else:
            depth -= 1
            if depth == 0:
                end = next_close
                break
            pos = next_close + 4
    if end is None:
        return text

    def tag_path(pm: re.Match[str]) -> str:
        t = pm.group(0)
        if "geo-region" not in t:
            if 'class="' in t:
                t = re.sub(r'class="([^"]*)"', r'class="\1 geo-region"', t, count=1)
            elif t.endswith("/>"):
                t = t[:-2] + ' class="geo-region"/>'
            else:
                t = t[:-1] + ' class="geo-region">'
        if "data-id=" not in t:
            if t.endswith("/>"):
                t = t[:-2] + f' data-id="{cont}"/>'
            else:
                t = t[:-1] + f' data-id="{cont}">'
        return t

    chunk = re.sub(r"<path\b[^>]*>", tag_path, text[i:end])
    return text[:i] + chunk + text[end:]


def build(src_path: Path) -> None:
    src = src_path.read_text()
    src = re.sub(r"<style[^>]*>.*?</style>", "", src, flags=re.S | re.I)
    src = re.sub(r"<title[^>]*>.*?</title>", "", src, flags=re.S | re.I)
    src = re.sub(r"<desc[^>]*>.*?</desc>", "", src, flags=re.S | re.I)
    src = re.sub(r"<!--.*?-->", "", src, flags=re.S)
    src = re.sub(r'<path[^>]*\bid="ocean"[^/]*/>', "", src)
    src = re.sub(r'<path[^>]*\bid="ocean"[^>]*>.*?</path>', "", src, flags=re.S)
    src = re.sub(r'\bclass\s*=\s*"', 'class="', src)
    src = re.sub(r"<(?:path|g)\b[^>]*>", rewrite_open_tag, src)
    # Keep geo-region only on paths (avoid double handlers on nested groups)
    src = re.sub(
        r"<g\b[^>]*geo-region[^>]*>",
        lambda m: m.group(0).replace(" geo-region", "").replace("geo-region ", "").replace("geo-region", ""),
        src,
    )
    src = re.sub(
        r"<svg\b[^>]*>",
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2754 1398" width="100%" height="100%" role="img" aria-label="World continents map">',
        src,
        count=1,
    )
    src = src.replace(
        'aria-label="World continents map">',
        'aria-label="World continents map">\n  <rect width="2754" height="1398" fill="#dce9f5"/>\n',
        1,
    )
    src = tag_paths_in_group(src, "aq", "AN")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    continents = OUT_DIR / "continents.svg"
    continents.write_text(src)
    oceans = OUT_DIR / "continents-oceans.svg"
    oceans.write_text(
        src.replace(
            '<rect width="2754" height="1398" fill="#dce9f5"/>',
            '<rect width="2754" height="1398" fill="#dce9f5"/>\n' + OCEANS,
            1,
        )
    )
    counts = Counter(re.findall(r'data-id="([A-Z]{2})"', continents.read_text()))
    print(f"Wrote {continents} ({continents.stat().st_size} bytes)")
    print(f"Wrote {oceans} ({oceans.stat().st_size} bytes)")
    print("Continent path counts:", dict(counts))


if __name__ == "__main__":
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/BlankMap-World.svg")
    if not path.exists():
        sys.exit(f"Missing source SVG: {path}")
    build(path)
