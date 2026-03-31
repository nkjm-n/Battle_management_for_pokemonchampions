from __future__ import annotations

import datetime as dt
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


API_BASE = "https://pokeapi.co/api/v2"
OUTPUT_PATH = Path("move.md")
MAX_WORKERS = 24
VAR_PATTERN = re.compile(r"\$effect_chance")

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

DAMAGE_CLASS_KIND_MAP = {
    "physical": ("攻撃技", "物理"),
    "special": ("攻撃技", "特殊"),
    "status": ("変化技", "—"),
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
    session.headers.update({"User-Agent": "poke-champ-move-builder/1.0"})
    return session


SESSION = build_session()


def get_json(url: str) -> dict[str, Any]:
    response = SESSION.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def resource_id_from_url(url: str) -> int:
    path = urlparse(url).path.rstrip("/")
    return int(path.split("/")[-1])


def normalize_text(text: str) -> str:
    text = VAR_PATTERN.sub("30", text)
    text = text.replace("\n", " ").replace("\f", " ").replace("\r", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def escape_md_cell(text: str) -> str:
    return text.replace("|", r"\|")


def get_localized_name(entries: list[dict[str, Any]]) -> str:
    for language in ("ja", "ja-Hrkt", "en"):
        name = next((entry["name"] for entry in entries if entry["language"]["name"] == language), None)
        if name:
            return name
    return entries[0]["name"] if entries else ""


def best_move_effect(payload: dict[str, Any]) -> tuple[str, str]:
    ja_entries = [
        entry
        for entry in payload.get("flavor_text_entries", [])
        if entry["language"]["name"] in ("ja", "ja-Hrkt")
    ]
    if ja_entries:
        latest = max(ja_entries, key=lambda entry: resource_id_from_url(entry["version_group"]["url"]))
        return normalize_text(latest["flavor_text"]), "ja"

    en_effect = next(
        (
            entry.get("short_effect") or entry.get("effect", "")
            for entry in payload.get("effect_entries", [])
            if entry["language"]["name"] == "en" and (entry.get("short_effect") or entry.get("effect"))
        ),
        "",
    )
    if en_effect:
        return normalize_text(en_effect), "en"

    return "説明なし", "none"


def fetch_move(url: str) -> dict[str, Any]:
    payload = get_json(url)
    move_kind, attack_class = DAMAGE_CLASS_KIND_MAP.get(
        payload["damage_class"]["name"],
        ("攻撃技", "—"),
    )
    effect, effect_language = best_move_effect(payload)
    return {
        "id": payload["id"],
        "name": get_localized_name(payload.get("names", [])),
        "type": TYPE_NAME_MAP.get(payload["type"]["name"], payload["type"]["name"]),
        "move_kind": move_kind,
        "attack_class": attack_class,
        "power": payload["power"] if payload["power"] is not None else "—",
        "pp": payload["pp"],
        "effect": effect,
        "effect_language": effect_language,
    }


def parallel_map(items: list[Any], fn) -> list[Any]:
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        return list(executor.map(fn, items))


def render_rows(moves: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    for move in sorted(moves, key=lambda row: row["id"]):
        effect_text = move["effect"]
        if move["effect_language"] == "en":
            effect_text = f"[EN] {effect_text}"

        lines.append(
            f"| {move['id']} | "
            f"{escape_md_cell(str(move['name']))} | "
            f"{escape_md_cell(str(move['type']))} | "
            f"{escape_md_cell(str(move['move_kind']))} | "
            f"{escape_md_cell(str(move['attack_class']))} | "
            f"{move['power']} | "
            f"{move['pp']} | "
            f"{escape_md_cell(effect_text)} |"
        )
    return lines


def main() -> None:
    move_results = get_json(f"{API_BASE}/move?limit=2000")["results"]
    move_urls = [move["url"] for move in move_results]
    moves = parallel_map(move_urls, fetch_move)

    english_fallback_count = sum(1 for move in moves if move["effect_language"] == "en")
    missing_description_count = sum(1 for move in moves if move["effect_language"] == "none")

    lines = [
        "# Move Data",
        "",
        f"- 生成日: {dt.date.today().isoformat()}",
        f"- 収録対象: PokeAPI の `move` エンドポイントに存在する全 {len(moves)} 件",
        "- 効果: 最新の日本語説明を優先し、ない場合は英語の効果説明にフォールバック",
        f"- 英語フォールバック件数: {english_fallback_count} 件",
        f"- 説明なし件数: {missing_description_count} 件",
        "",
        "| ID | 技名 | タイプ | 技の種類 | 分類 | 威力 | PP | 効果 |",
        "| ---: | --- | --- | --- | --- | ---: | ---: | --- |",
    ]
    lines.extend(render_rows(moves))
    OUTPUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
