from __future__ import annotations

import datetime as dt
import html
import re
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


API_BASE = "https://pokeapi.co/api/v2"
GAMEGC_ABILITY_URL = "https://gamegc.net/pokemon-sv/ability/{ability_id}/"
OUTPUT_PATH = Path("pokemon.md")
MAX_WORKERS = 24
ABILITY_EFFECT_SECTION_RE = re.compile(r"<h2>\s*特性の効果\s*</h2>\s*<p>(.*?)</p>", re.S)
ABILITY_TITLE_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
HTML_TAG_RE = re.compile(r"<[^>]+>")
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
    session.headers.update({"User-Agent": "poke-champ-data-builder/1.0"})
    return session


SESSION = build_session()


def get_json(url: str) -> dict[str, Any]:
    response = SESSION.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def resource_id_from_url(url: str) -> int:
    path = urlparse(url).path.rstrip("/")
    return int(path.split("/")[-1])


def get_localized_name(entries: list[dict[str, Any]], language: str = "ja", fallback: str = "en") -> str:
    preferred = next((entry["name"] for entry in entries if entry["language"]["name"] == language), None)
    if preferred:
        return preferred
    fallback_name = next((entry["name"] for entry in entries if entry["language"]["name"] == fallback), None)
    if fallback_name:
        return fallback_name
    return entries[0]["name"] if entries else ""


def normalize_text(text: str) -> str:
    text = text.replace("\n", "").replace("\f", "").replace("\r", "")
    text = re.sub(r"（※[^）]*）", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def escape_md_cell(text: str) -> str:
    return text.replace("|", r"\|")


def strip_html(text: str) -> str:
    return normalize_text(HTML_TAG_RE.sub("", html.unescape(text)))


@lru_cache(maxsize=None)
def fetch_gamegc_ability_page(ability_id: int) -> dict[str, str]:
    try:
        response = SESSION.get(GAMEGC_ABILITY_URL.format(ability_id=ability_id), timeout=30)
        response.raise_for_status()
    except requests.RequestException:
        return {"name_ja": "", "effect": ""}

    title_match = ABILITY_TITLE_RE.search(response.text)
    effect_match = ABILITY_EFFECT_SECTION_RE.search(response.text)
    return {
        "name_ja": strip_html(title_match.group(1)) if title_match else "",
        "effect": strip_html(effect_match.group(1)) if effect_match else "",
    }


def best_ability_description(payload: dict[str, Any]) -> str:
    ja_entries = [entry for entry in payload.get("flavor_text_entries", []) if entry["language"]["name"] == "ja"]
    if ja_entries:
        latest = max(ja_entries, key=lambda entry: resource_id_from_url(entry["version_group"]["url"]))
        return normalize_text(latest["flavor_text"])

    gamegc_effect = fetch_gamegc_ability_page(payload["id"])["effect"]
    if gamegc_effect:
        return gamegc_effect

    en_entries = [entry for entry in payload.get("flavor_text_entries", []) if entry["language"]["name"] == "en"]
    if en_entries:
        latest = max(en_entries, key=lambda entry: resource_id_from_url(entry["version_group"]["url"]))
        return normalize_text(latest["flavor_text"])

    en_effect = next(
        (entry.get("short_effect") or entry.get("effect", "") for entry in payload.get("effect_entries", []) if entry["language"]["name"] == "en"),
        "",
    )
    return normalize_text(en_effect)


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


def fetch_pokemon(variety: dict[str, Any]) -> dict[str, Any]:
    payload = get_json(variety["pokemon_url"])
    stats = {entry["stat"]["name"]: entry["base_stat"] for entry in payload["stats"]}
    abilities = sorted(payload["abilities"], key=lambda entry: entry["slot"])
    return {
        "pokemon_id": payload["id"],
        "species_id": resource_id_from_url(payload["species"]["url"]),
        "base_name_ja": variety["base_name_ja"],
        "pokemon_name": variety["pokemon_name"],
        "is_default": variety["is_default"],
        "form_url": payload["forms"][0]["url"] if payload["forms"] else "",
        "stats": {
            "hp": stats["hp"],
            "attack": stats["attack"],
            "defense": stats["defense"],
            "special-attack": stats["special-attack"],
            "special-defense": stats["special-defense"],
            "speed": stats["speed"],
        },
        "abilities": [
            {
                "url": entry["ability"]["url"],
                "is_hidden": entry["is_hidden"],
                "slot": entry["slot"],
            }
            for entry in abilities
        ],
    }


def fetch_form_name(url: str) -> dict[str, str]:
    payload = get_json(url)
    localized_name = get_localized_name(payload.get("form_names", []), language="ja")
    if not localized_name:
        localized_name = get_localized_name(payload.get("form_names", []), language="ja-hrkt")
    if not localized_name:
        localized_name = get_localized_name(payload.get("names", []), language="ja")
    return {
        "name_ja": localized_name,
        "is_mega": bool(payload.get("is_mega")),
    }


def fetch_ability(url: str) -> dict[str, str]:
    payload = get_json(url)
    ja_name = next((entry["name"] for entry in payload["names"] if entry["language"]["name"] == "ja"), None)
    if not ja_name:
        ja_name = fetch_gamegc_ability_page(payload["id"])["name_ja"]
    if not ja_name:
        ja_name = get_localized_name(payload["names"], language="ja")
    return {
        "name_ja": ja_name,
        "effect": best_ability_description(payload),
    }


def parallel_map(ids: list[Any], fn) -> list[Any]:
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        return list(executor.map(fn, ids))


def render_rows(
    pokemon_rows: list[dict[str, Any]],
    form_names_by_url: dict[str, dict[str, str]],
    abilities_by_url: dict[str, dict[str, str]],
) -> list[str]:
    lines: list[str] = []

    for pokemon in sorted(
        pokemon_rows,
        key=lambda row: (row["species_id"], 0 if row["is_default"] else 1, row["pokemon_id"]),
    ):
        normal_abilities = []
        hidden_ability = None

        for ability_ref in pokemon["abilities"]:
            ability = abilities_by_url[ability_ref["url"]]
            ability_data = {
                "name": ability["name_ja"],
                "effect": ability["effect"],
            }
            if ability_ref["is_hidden"]:
                hidden_ability = ability_data
            else:
                normal_abilities.append(ability_data)

        normal_names = "<br>".join(escape_md_cell(entry["name"]) for entry in normal_abilities) or "なし"
        normal_effects = "<br>".join(escape_md_cell(entry["effect"]) for entry in normal_abilities) or "なし"
        hidden_name = escape_md_cell(hidden_ability["name"]) if hidden_ability else "なし"
        hidden_effect = escape_md_cell(hidden_ability["effect"]) if hidden_ability else "なし"

        if pokemon["is_default"]:
            display_name = pokemon["base_name_ja"]
        else:
            display_name = form_names_by_url.get(pokemon["form_url"], {}).get("name_ja") or pokemon["base_name_ja"]

        stats = pokemon["stats"]
        line = (
            f"| {escape_md_cell(display_name)} | "
            f"{stats['hp']} | {stats['attack']} | {stats['defense']} | "
            f"{stats['special-attack']} | {stats['special-defense']} | {stats['speed']} | "
            f"{normal_names} | {normal_effects} | {hidden_name} | {hidden_effect} |"
        )
        lines.append(line)

    return lines


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

    pokemon_rows = parallel_map(varieties, fetch_pokemon)
    form_urls = sorted(
        {
            pokemon["form_url"]
            for pokemon in pokemon_rows
            if pokemon["form_url"] and not pokemon["is_default"]
        },
        key=resource_id_from_url,
    )
    form_name_rows = parallel_map(form_urls, fetch_form_name)
    form_names_by_url = dict(zip(form_urls, form_name_rows))

    ability_urls = sorted(
        {
            ability_ref["url"]
            for pokemon in pokemon_rows
            for ability_ref in pokemon["abilities"]
        },
        key=resource_id_from_url,
    )
    ability_rows = parallel_map(ability_urls, fetch_ability)
    abilities_by_url = dict(zip(ability_urls, ability_rows))

    lines = [
        "# Pokemon Data",
        "",
        f"- 生成日: {dt.date.today().isoformat()}",
        f"- 収録対象: 全国図鑑No.1〜{species_count}の基本種（各ポケモンのデフォルトフォルム）と公式メガシンカフォルム",
        "- データソース: PokeAPI の `pokemon-species`, `pokemon`, `ability` エンドポイント",
        "- 特性の効果: `ability.flavor_text_entries` の最新日本語説明を採用",
        "",
        "| ポケモンの名前 | HP | 攻撃 | 防御 | 特攻 | 特防 | すばやさ | 特性 | 特性の効果 | 夢特性 | 夢特性の効果 |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |",
    ]
    lines.extend(render_rows(pokemon_rows, form_names_by_url, abilities_by_url))
    OUTPUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
