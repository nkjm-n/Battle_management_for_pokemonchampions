from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


API_BASE = "https://pokeapi.co/api/v2"
OUTPUT_PATH = Path("src/lib/pokemonTypes.json")
MAX_WORKERS = 24
TYPE_NAME_MAP = {
    "normal": "ノーマル",
    "fire": "ほのお",
    "water": "みず",
    "electric": "でんき",
    "grass": "くさ",
    "ice": "こおり",
    "fighting": "かくとう",
    "poison": "どく",
    "ground": "じめん",
    "flying": "ひこう",
    "psychic": "エスパー",
    "bug": "むし",
    "rock": "いわ",
    "ghost": "ゴースト",
    "dragon": "ドラゴン",
    "dark": "あく",
    "steel": "はがね",
    "fairy": "フェアリー",
    "stellar": "ステラ",
    "unknown": "不明",
}
OFFICIAL_MEGA_POKEMON_NAMES = {
    "venusaur-mega",
    "charizard-mega-x",
    "charizard-mega-y",
    "blastoise-mega",
    "beedrill-mega",
    "pidgeot-mega",
    "alakazam-mega",
    "slowbro-mega",
    "gengar-mega",
    "kangaskhan-mega",
    "pinsir-mega",
    "gyarados-mega",
    "aerodactyl-mega",
    "mewtwo-mega-x",
    "mewtwo-mega-y",
    "ampharos-mega",
    "steelix-mega",
    "scizor-mega",
    "heracross-mega",
    "houndoom-mega",
    "tyranitar-mega",
    "sceptile-mega",
    "blaziken-mega",
    "swampert-mega",
    "gardevoir-mega",
    "sableye-mega",
    "mawile-mega",
    "aggron-mega",
    "medicham-mega",
    "manectric-mega",
    "sharpedo-mega",
    "camerupt-mega",
    "altaria-mega",
    "banette-mega",
    "absol-mega",
    "glalie-mega",
    "salamence-mega",
    "metagross-mega",
    "latias-mega",
    "latios-mega",
    "rayquaza-mega",
    "lopunny-mega",
    "garchomp-mega",
    "lucario-mega",
    "abomasnow-mega",
    "gallade-mega",
    "audino-mega",
    "diancie-mega",
}


def build_session() -> requests.Session:
    retry = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=MAX_WORKERS, pool_maxsize=MAX_WORKERS)
    session = requests.Session()
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update({"User-Agent": "poke-champ-type-builder/1.0"})
    return session


SESSION = build_session()


def get_json(url: str) -> dict[str, Any]:
    response = SESSION.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def resource_id_from_url(url: str) -> int:
    return int(urlparse(url).path.rstrip("/").split("/")[-1])


def get_localized_name(entries: list[dict[str, Any]], language: str = "ja", fallback: str = "en") -> str:
    preferred = next((entry["name"] for entry in entries if entry["language"]["name"] == language), None)
    if preferred:
        return preferred
    fallback_name = next((entry["name"] for entry in entries if entry["language"]["name"] == fallback), None)
    if fallback_name:
        return fallback_name
    return entries[0]["name"] if entries else ""


def parallel_map(items: list[Any], fn) -> list[Any]:
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        return list(executor.map(fn, items))


def fetch_species_count() -> int:
    payload = get_json(f"{API_BASE}/pokemon-species?limit=1")
    return int(payload["count"])


def fetch_species(species_id: int) -> dict[str, Any]:
    payload = get_json(f"{API_BASE}/pokemon-species/{species_id}")
    return {
        "id": payload["id"],
        "base_name_ja": get_localized_name(payload["names"], language="ja"),
        "varieties": [
            {
                "pokemon_name": variety["pokemon"]["name"],
                "pokemon_url": variety["pokemon"]["url"],
                "is_default": variety["is_default"],
            }
            for variety in payload["varieties"]
        ],
    }


def should_include_variety(variety: dict[str, Any]) -> bool:
    return variety["is_default"] or variety["pokemon_name"] in OFFICIAL_MEGA_POKEMON_NAMES


def fetch_form_name(url: str) -> str:
    payload = get_json(url)
    localized_name = get_localized_name(payload.get("form_names", []), language="ja")
    if not localized_name:
        localized_name = get_localized_name(payload.get("form_names", []), language="ja-hrkt")
    if not localized_name:
        localized_name = get_localized_name(payload.get("names", []), language="ja")
    return localized_name


def fetch_pokemon_types(variety: dict[str, Any]) -> tuple[int, int, str, list[str]]:
    payload = get_json(variety["pokemon_url"])
    type_names = [
        TYPE_NAME_MAP.get(type_entry["type"]["name"], type_entry["type"]["name"])
        for type_entry in sorted(payload["types"], key=lambda entry: entry["slot"])
    ]
    if variety["is_default"]:
        display_name = variety["base_name_ja"]
    else:
        form_url = payload["forms"][0]["url"] if payload["forms"] else ""
        display_name = fetch_form_name(form_url) if form_url else variety["base_name_ja"]
    return resource_id_from_url(payload["species"]["url"]), payload["id"], display_name, type_names


def main() -> None:
    species_count = fetch_species_count()
    species_rows = parallel_map(list(range(1, species_count + 1)), fetch_species)
    varieties = [
        {
            **variety,
            "species_id": species["id"],
            "base_name_ja": species["base_name_ja"],
        }
        for species in species_rows
        for variety in species["varieties"]
        if should_include_variety(variety)
    ]
    type_rows = parallel_map(varieties, fetch_pokemon_types)

    type_map = {
        name_ja: type_names
        for _, _, name_ja, type_names in sorted(type_rows, key=lambda row: (row[0], row[1]))
    }

    OUTPUT_PATH.write_text(
        json.dumps(type_map, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
