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
    default_variety = next(variety for variety in payload["varieties"] if variety["is_default"])
    return {
        "id": payload["id"],
        "name_ja": get_localized_name(payload["names"], language="ja"),
        "default_pokemon_url": default_variety["pokemon"]["url"],
    }


def fetch_pokemon_types(species: dict[str, Any]) -> tuple[int, str, list[str]]:
    payload = get_json(species["default_pokemon_url"])
    type_names = [
        TYPE_NAME_MAP.get(type_entry["type"]["name"], type_entry["type"]["name"])
        for type_entry in sorted(payload["types"], key=lambda entry: entry["slot"])
    ]
    return species["id"], species["name_ja"], type_names


def main() -> None:
    species_count = fetch_species_count()
    species_rows = parallel_map(list(range(1, species_count + 1)), fetch_species)
    type_rows = parallel_map(species_rows, fetch_pokemon_types)

    type_map = {
        name_ja: type_names
        for _, name_ja, type_names in sorted(type_rows, key=lambda row: row[0])
    }

    OUTPUT_PATH.write_text(
        json.dumps(type_map, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
