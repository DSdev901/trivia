#!/usr/bin/env python3
"""Build data/geography/largest-cities.json from a GeoNames cities dump."""

from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "geography" / "largest-cities.json"
DUMP = Path("/tmp/geo-cities/cities15000.txt")

SKIP_CODES = {"PPLX", "PPLQ", "PPLW", "PPLH", "PPLCH", "PPLF", "PPLS"}
CA_ADMIN = {
    "01": "AB",
    "02": "BC",
    "03": "MB",
    "04": "NB",
    "05": "NL",
    "07": "NS",
    "08": "ON",
    "09": "PE",
    "10": "QC",
    "11": "SK",
    "12": "YT",
    "13": "NT",
    "14": "NU",
}
NAME_FIX = {
    "new york city": "New York",
    "kiev": "Kyiv",
    "bombay": "Mumbai",
    "calcutta": "Kolkata",
    "madras": "Chennai",
    "bengaluru": "Bangalore",
    "peking": "Beijing",
    "saigon": "Ho Chi Minh City",
    "rangoon": "Yangon",
    "santiago de chile": "Santiago",
    "montreal": "Montreal",
    "montréal": "Montreal",
    "zürich": "Zurich",
    "zurich": "Zurich",
    "gent": "Ghent",
    "thessaloniki": "Thessaloniki",
    "patra": "Patras",
    "pátra": "Patras",
    "aarhus": "Aarhus",
    "århus": "Aarhus",
    "makkah": "Mecca",
    "mecca": "Mecca",
    "ulan bator": "Ulaanbaatar",
    "nay pyi taw": "Naypyidaw",
    "quebec": "Quebec City",
    "québec": "Quebec City",
    "gomel": "Gomel",
    "homyel": "Gomel",
}

# Boroughs, communes, and metro pieces that outrank the city people mean.
SKIP_NAMES = {
    "brooklyn", "queens", "manhattan", "the bronx", "bronx", "staten island",
    "iztapalapa", "gustavo adolfo madero", "ecatepec de morelos",
    "nezahualcoyotl", "tlalnepantla", "naucalpan", "zapopan",
    "puente alto", "maipu", "penalolen", "san bernardo", "la florida",
    "ulu bedok", "bedok new town", "sengkang new town", "jurong town",
    "jurong west", "woodlands", "yishun new town", "punggol",
    "choa chu kang new town", "ang mo kio new town", "kampong pasir ris",
    "caloocan", "taguig", "pasig city", "pasig", "antipolo", "valenzuela",
    "paranaque", "las pinas", "budta", "malingao",
    "santo domingo oeste", "santo domingo este", "santo domingo norte",
    "mixco", "villa nueva", "san miguelito", "juan diaz", "tocumen",
    "soyapango", "mejicanos", "apopa", "carrefour", "delmas",
    "petionville", "petion-ville", "portmore",
    "bekasi", "tangerang", "depok", "callao",
    "kampung baru subang", "dehiwala mount lavinia", "maharagama",
    "mulenvos", "viana", "nasinu",
    "samut prakan", "mueang nonthaburi", "phra pradaeng", "bang khae",
    "pak kret", "sai mai", "watthana", "khlong sam wa",
    "almere stad", "longueuil", "laval",
}

OVERRIDES = {
    "US": ["New York", "Los Angeles", "Chicago"],
    "MX": ["Mexico City", "Guadalajara", "Monterrey"],
    "NL": ["Amsterdam", "Rotterdam", "The Hague"],
    "PH": ["Quezon City", "Manila", "Davao"],
    "TH": ["Bangkok", "Chiang Mai", "Nakhon Ratchasima"],
    "SG": ["Singapore"],
    "CL": ["Santiago", "Valparaíso", "Concepción"],
    "PK": ["Karachi", "Lahore", "Faisalabad"],
    "SA": ["Riyadh", "Jeddah", "Mecca"],
    "KE": ["Nairobi", "Mombasa", "Kisumu"],
    "CN": ["Shanghai", "Beijing", "Shenzhen"],
    "JP": ["Tokyo", "Osaka", "Nagoya"],
    "CA": ["Toronto", "Montreal", "Vancouver"],
    "ID": ["Jakarta", "Surabaya", "Bandung"],
    "PE": ["Lima", "Arequipa", "Trujillo"],
    "EC": ["Guayaquil", "Quito", "Cuenca"],
    "BO": ["Santa Cruz de la Sierra", "El Alto", "La Paz"],
    "GT": ["Guatemala City", "Quetzaltenango", "Escuintla"],
    "PA": ["Panama City", "Colón", "David"],
    "SV": ["San Salvador", "Santa Ana", "San Miguel"],
    "HT": ["Port-au-Prince", "Cap-Haïtien", "Gonaïves"],
    "DO": ["Santo Domingo", "Santiago", "La Romana"],
    "AO": ["Luanda", "Huambo", "Lobito"],
    "MY": ["Kuala Lumpur", "George Town", "Johor Bahru"],
    "LK": ["Colombo", "Kandy", "Jaffna"],
    "ET": ["Addis Ababa", "Dire Dawa", "Mekelle"],
    "TW": ["Taipei", "Kaohsiung", "Taichung"],
    "TR": ["Istanbul", "Ankara", "Izmir"],
    "CO": ["Bogotá", "Medellín", "Cali"],
    "BE": ["Brussels", "Antwerp", "Ghent"],
    "BH": ["Manama", "Muharraq", "Riffa"],
    "CH": ["Zurich", "Geneva", "Basel"],
    "GR": ["Athens", "Thessaloniki", "Patras"],
    "FJ": ["Suva", "Lautoka", "Nadi"],
    "GH": ["Accra", "Kumasi", "Tamale"],
    "GB": ["London", "Birmingham", "Manchester"],
    "IN": ["Mumbai", "Delhi", "Bangalore"],
}

US_OVERRIDES = {
    "NY": ["New York", "Buffalo", "Rochester"],
}

CA_OVERRIDES = {
    "ON": ["Toronto", "Ottawa", "Mississauga"],
    "QC": ["Montreal", "Quebec City", "Gatineau"],
    "BC": ["Vancouver", "Surrey", "Victoria"],
}


def fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.lower()
    s = re.sub(r"\b(city|municipality|district|county|township|prefecture|new town)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def display_name(name: str) -> str:
    return NAME_FIX.get(fold(name), name)


def skip_name(name: str) -> bool:
    key = fold(name)
    if key in SKIP_NAMES:
        return True
    if "new town" in name.lower() or name.lower().startswith("kampong "):
        return True
    return False


def topn(rows: list, n: int = 3) -> list[str]:
    rows.sort(reverse=True)
    out: list[str] = []
    seen: set[str] = set()
    for _pop, display, key in rows:
        if key in seen or skip_name(display):
            continue
        seen.add(key)
        out.append(display)
        if len(out) == n:
            break
    return out


def parse_dump() -> tuple[dict, dict, dict]:
    by_cc: dict[str, list] = defaultdict(list)
    by_us: dict[str, list] = defaultdict(list)
    by_ca: dict[str, list] = defaultdict(list)
    for line in DUMP.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) < 15:
            continue
        name, fclass, fcode, cc, admin1, pop = (
            parts[1],
            parts[6],
            parts[7],
            parts[8],
            parts[10],
            parts[14],
        )
        if fclass != "P" or fcode in SKIP_CODES:
            continue
        try:
            population = int(pop)
        except ValueError:
            continue
        if population <= 0:
            continue
        display = display_name(name)
        key = fold(display)
        row = (population, display, key)
        by_cc[cc].append(row)
        if cc == "US" and len(admin1) == 2:
            by_us[admin1].append(row)
        if cc == "CA":
            code = CA_ADMIN.get(admin1)
            if code:
                by_ca[code].append(row)
    return by_cc, by_us, by_ca


def country_names() -> dict[str, str]:
    names: dict[str, str] = {
        "HK": "Hong Kong",
        "XK": "Kosovo",
        "PR": "Puerto Rico",
        "PS": "Palestine",
        "TW": "Taiwan",
        "GF": "French Guiana",
        "GP": "Guadeloupe",
        "MQ": "Martinique",
        "RE": "Réunion",
        "YT": "Mayotte",
        "NC": "New Caledonia",
        "PF": "French Polynesia",
        "GU": "Guam",
        "VI": "U.S. Virgin Islands",
        "AS": "American Samoa",
        "MP": "Northern Mariana Islands",
        "CK": "Cook Islands",
        "NU": "Niue",
        "TK": "Tokelau",
        "EH": "Western Sahara",
        "FO": "Faroe Islands",
        "GL": "Greenland",
        "GI": "Gibraltar",
        "AX": "Åland",
        "IM": "Isle of Man",
        "JE": "Jersey",
        "GG": "Guernsey",
        "AW": "Aruba",
        "CW": "Curaçao",
        "SX": "Sint Maarten",
        "BQ": "Caribbean Netherlands",
        "BL": "Saint Barthélemy",
        "MF": "Saint Martin",
        "PM": "Saint Pierre and Miquelon",
        "WF": "Wallis and Futuna",
        "SH": "Saint Helena",
        "FK": "Falkland Islands",
        "BM": "Bermuda",
        "KY": "Cayman Islands",
        "VG": "British Virgin Islands",
        "TC": "Turks and Caicos Islands",
        "MS": "Montserrat",
        "AI": "Anguilla",
        "MO": "Macau",
    }
    packs = [
        ROOT / "data" / "geography" / "world-countries.json",
        ROOT / "data" / "geography" / "oceania-territories.json",
        ROOT / "data" / "geography" / "europe-countries.json",
        ROOT / "data" / "geography" / "asia-countries.json",
        ROOT / "data" / "geography" / "africa-countries.json",
        ROOT / "data" / "geography" / "sa-countries.json",
    ]
    for path in packs:
        if not path.exists():
            continue
        for item in json.loads(path.read_text(encoding="utf-8")).get("items", []):
            cid = item.get("id")
            name = item.get("name")
            if cid and name:
                names[cid] = name
    return names


def apply_caps(countries: dict[str, list[str]]) -> None:
    packs = [
        ROOT / "data" / "geography" / "world-countries.json",
        ROOT / "data" / "geography" / "europe-countries.json",
        ROOT / "data" / "geography" / "oceania-territories.json",
        ROOT / "data" / "geography" / "sa-countries.json",
        ROOT / "data" / "geography" / "africa-countries.json",
        ROOT / "data" / "geography" / "asia-countries.json",
    ]
    seen: dict[str, str] = {}
    for path in packs:
        if not path.exists():
            continue
        for item in json.loads(path.read_text(encoding="utf-8")).get("items", []):
            cid = item.get("id")
            cap = item.get("capital")
            if cid and cap:
                seen[cid] = cap
    for cid, cap in seen.items():
        cities = countries.get(cid, [])
        if not cities:
            countries[cid] = [cap]
            continue
        if fold(cap) not in {fold(c) for c in cities} and len(cities) < 3:
            # Keep population order; capital is listed separately in the UI.
            pass


def main() -> None:
    if not DUMP.exists():
        raise SystemExit(f"Missing {DUMP}")
    by_cc, by_us, by_ca = parse_dump()
    countries = {cc: OVERRIDES.get(cc, topn(rows)) for cc, rows in by_cc.items()}
    for cc, names in OVERRIDES.items():
        countries[cc] = names
    us = {code: US_OVERRIDES.get(code, topn(rows)) for code, rows in by_us.items()}
    us.update(US_OVERRIDES)
    ca = {code: CA_OVERRIDES.get(code, topn(rows)) for code, rows in by_ca.items()}
    ca.update(CA_OVERRIDES)
    apply_caps(countries)
    payload = {
        "countries": dict(sorted(countries.items())),
        "countryNames": dict(sorted(country_names().items())),
        "us": dict(sorted(us.items())),
        "ca": dict(sorted(ca.items())),
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(countries)} countries, {len(us)} states, {len(ca)} provinces)")


if __name__ == "__main__":
    main()
