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
OUTPUT_PATH = Path("item.md")
MAX_WORKERS = 24

POCKET_NAME_MAP = {
    "misc": "道具",
    "medicine": "回復道具",
    "pokeballs": "モンスターボール",
    "machines": "わざマシン",
    "berries": "きのみ",
    "mail": "メール",
    "battle": "戦闘用",
    "key": "大切なもの",
}

ITEM_NAME_OVERRIDES = {
    "lastrange-ball": "ふしぎなボール",
    "lapoke-ball": "モンスターボール",
    "lagreat-ball": "スーパーボール",
    "laultra-ball": "ハイパーボール",
    "laheavy-ball": "ヘビーボール",
    "laleaden-ball": "メガトンボール",
    "lagigaton-ball": "ギガトンボール",
    "lafeather-ball": "フェザーボール",
    "lawing-ball": "ウイングボール",
    "lajet-ball": "ジェットボール",
    "laorigin-ball": "オリジンボール",
    "black-augurite": "くろのきせき",
    "peat-block": "ピートブロック",
}

VAR_PATTERN = re.compile(r"\[VAR \([0-9A-F]+\)\]")


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
    session.headers.update({"User-Agent": "poke-champ-item-builder/1.0"})
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
    text = VAR_PATTERN.sub("対象ポケモン", text)
    text = text.replace("\n", " ").replace("\f", " ").replace("\r", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def escape_md_cell(text: str) -> str:
    return text.replace("|", r"\|")


def humanize_slug(slug: str) -> str:
    return slug.replace("-", " ").title()


def get_localized_name(entries: list[dict[str, Any]]) -> str:
    for language in ("ja", "ja-hrkt", "en"):
        name = next((entry["name"] for entry in entries if entry["language"]["name"] == language), None)
        if name:
            return name
    return entries[0]["name"] if entries else ""


def best_item_name(payload: dict[str, Any]) -> str:
    if payload["name"] in ITEM_NAME_OVERRIDES:
        return ITEM_NAME_OVERRIDES[payload["name"]]

    localized_name = get_localized_name(payload.get("names", []))
    return localized_name or humanize_slug(payload["name"])


def best_item_effect(payload: dict[str, Any]) -> tuple[str, str]:
    ja_entries = [
        entry
        for entry in payload.get("flavor_text_entries", [])
        if entry["language"]["name"] in ("ja", "ja-hrkt")
    ]
    if ja_entries:
        latest = max(ja_entries, key=lambda entry: resource_id_from_url(entry["version_group"]["url"]))
        return normalize_text(latest["text"]), "ja"

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

    en_entries = [entry for entry in payload.get("flavor_text_entries", []) if entry["language"]["name"] == "en"]
    if en_entries:
        latest = max(en_entries, key=lambda entry: resource_id_from_url(entry["version_group"]["url"]))
        return normalize_text(latest["text"]), "en"

    return "説明なし", "none"


def fetch_item(url: str) -> dict[str, Any]:
    payload = get_json(url)
    effect, effect_language = best_item_effect(payload)
    return {
        "id": payload["id"],
        "name": best_item_name(payload),
        "cost": payload["cost"],
        "category_url": payload["category"]["url"],
        "effect": effect,
        "effect_language": effect_language,
    }


def fetch_category(url: str) -> tuple[str, str]:
    payload = get_json(url)
    pocket_slug = payload["pocket"]["name"]
    pocket_name = POCKET_NAME_MAP.get(pocket_slug, humanize_slug(pocket_slug))
    return url, pocket_name


def parallel_map(items: list[Any], fn) -> list[Any]:
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        return list(executor.map(fn, items))


def render_rows(items: list[dict[str, Any]], pocket_by_category: dict[str, str]) -> list[str]:
    lines: list[str] = []
    for item in sorted(items, key=lambda row: row["id"]):
        effect_text = item["effect"]
        if item["effect_language"] == "en":
            effect_text = f"[EN] {effect_text}"

        lines.append(
            f"| {item['id']} | "
            f"{escape_md_cell(item['name'])} | "
            f"{escape_md_cell(pocket_by_category[item['category_url']])} | "
            f"{item['cost']} | "
            f"{escape_md_cell(effect_text)} |"
        )
    return lines


def main() -> None:
    item_results = get_json(f"{API_BASE}/item?limit=3000")["results"]
    item_urls = [item["url"] for item in item_results]
    items = parallel_map(item_urls, fetch_item)

    category_urls = sorted({item["category_url"] for item in items}, key=resource_id_from_url)
    pocket_by_category = dict(parallel_map(category_urls, fetch_category))

    english_fallback_count = sum(1 for item in items if item["effect_language"] == "en")
    missing_description_count = sum(1 for item in items if item["effect_language"] == "none")

    lines = [
        "# Item Data",
        "",
        f"- 生成日: {dt.date.today().isoformat()}",
        f"- 収録対象: PokeAPI の `item` エンドポイントに存在する全 {len(items)} 件",
        "- 効果: 最新の日本語説明を優先し、ない場合は英語の `short_effect` または英語説明にフォールバック",
        f"- 英語フォールバック件数: {english_fallback_count} 件",
        f"- 説明なし件数: {missing_description_count} 件",
        "- 一部の道具名は PokeAPI に日本語名がないため、一般的な日本語表記で補完",
        "",
        "| ID | 道具名 | ポケット | 値段 | 効果 |",
        "| ---: | --- | --- | ---: | --- |",
    ]
    lines.extend(render_rows(items, pocket_by_category))
    OUTPUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
