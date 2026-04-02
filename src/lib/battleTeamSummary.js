import { itemList, getPokemonRecordByName } from "./data";
import { getEntryTypes } from "./pokemonEntryDisplay";
import {
  POKEMON_TYPE_NAMES,
  buildActualStats,
  getAttackStatKeyForMove,
  getTypeEffectivenessMultiplier,
} from "./pokemonDamage";

const itemByName = new Map(itemList.map((item) => [item.name, item]));

export const BATTLE_TEAM_DISPLAY_TYPE_NAMES = POKEMON_TYPE_NAMES.filter(
  (typeName) => typeName !== "ステラ" && typeName !== "不明",
);

export const BATTLE_TEAM_MATCHUP_ROWS = [
  { key: "super4", label: "抜群", detail: "×4" },
  { key: "super2", label: "抜群", detail: "×2" },
  { key: "normal", label: "通常", detail: "×1" },
  { key: "resisted2", label: "いまいち", detail: "×1/2" },
  { key: "resisted4", label: "いまいち", detail: "×1/4" },
  { key: "none", label: "効果なし", detail: "×0" },
];

function normalizeEffectText(value) {
  return String(value ?? "").replace(/[ 　]+/g, " ").trim();
}

function createCountMap() {
  return Object.fromEntries(BATTLE_TEAM_MATCHUP_ROWS.map((row) => [row.key, 0]));
}

export function getMatchupBucketKey(multiplier) {
  if (multiplier === 4) {
    return "super4";
  }

  if (multiplier === 2) {
    return "super2";
  }

  if (multiplier === 0) {
    return "none";
  }

  if (multiplier === 0.25) {
    return "resisted4";
  }

  if (multiplier === 0.5) {
    return "resisted2";
  }

  return "normal";
}

export function buildBattleTeamOffensiveMatrix(entries) {
  const attackingMoves = entries.flatMap((entry) =>
    (entry.moves ?? []).filter((move) => move && getAttackStatKeyForMove(move)),
  );

  const countsByType = Object.fromEntries(
    BATTLE_TEAM_DISPLAY_TYPE_NAMES.map((typeName) => [typeName, createCountMap()]),
  );

  attackingMoves.forEach((move) => {
    BATTLE_TEAM_DISPLAY_TYPE_NAMES.forEach((typeName) => {
      const multiplier = getTypeEffectivenessMultiplier(move.type, [typeName]);
      const bucketKey = getMatchupBucketKey(multiplier);
      countsByType[typeName][bucketKey] += 1;
    });
  });

  return {
    hasData: attackingMoves.length > 0,
    countsByType,
  };
}

export function buildBattleTeamDefensiveMatrix(entries) {
  const countsByType = Object.fromEntries(
    BATTLE_TEAM_DISPLAY_TYPE_NAMES.map((typeName) => [typeName, createCountMap()]),
  );

  entries.forEach((entry) => {
    const defenderTypes = getEntryTypes(entry);
    BATTLE_TEAM_DISPLAY_TYPE_NAMES.forEach((typeName) => {
      const multiplier = getTypeEffectivenessMultiplier(typeName, defenderTypes);
      const bucketKey = getMatchupBucketKey(multiplier);
      countsByType[typeName][bucketKey] += 1;
    });
  });

  return {
    hasData: entries.length > 0,
    countsByType,
  };
}

function getResolvedActualStats(entry) {
  if (
    entry?.actualStats &&
    ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"].every((key) =>
      Number.isFinite(entry.actualStats[key]),
    )
  ) {
    return entry.actualStats;
  }

  const pokemon = getPokemonRecordByName(entry?.pokemonName);
  if (!pokemon) {
    return null;
  }

  return buildActualStats(pokemon, entry?.spValues ?? {}, entry?.natureName ?? "まじめ");
}

function getFirepowerItemMultiplier(itemName, move, attackStatKey) {
  if (!itemName || !move || !attackStatKey) {
    return 1;
  }

  const effectText = normalizeEffectText(itemByName.get(itemName)?.effect);

  if (itemName === "こだわりハチマキ" && attackStatKey === "attack") {
    return 1.5;
  }

  if (itemName === "こだわりメガネ" && attackStatKey === "specialAttack") {
    return 1.5;
  }

  if (itemName === "いのちのたま") {
    return 1.3;
  }

  if (itemName === "ちからのハチマキ" && attackStatKey === "attack") {
    return 1.1;
  }

  if (itemName === "ものしりメガネ" && attackStatKey === "specialAttack") {
    return 1.1;
  }

  if (!effectText) {
    return 1;
  }

  const typeBoostMatch =
    effectText.match(/([^\s]+)タイプの わざの いりょくが あがる/) ??
    effectText.match(/([^\s]+)の タイプの ジュエル/);

  if (typeBoostMatch?.[1] && move.type === typeBoostMatch[1]) {
    return effectText.includes("いちどだけ") || effectText.includes("つよまる") ? 1.3 : 1.2;
  }

  return 1;
}

function buildFirepowerCandidate(entry, move) {
  const attackStatKey = getAttackStatKeyForMove(move);
  if (!attackStatKey || !Number.isFinite(move?.power)) {
    return null;
  }

  const actualStats = getResolvedActualStats(entry);
  const attackValue = actualStats?.[attackStatKey];
  if (!Number.isFinite(attackValue)) {
    return null;
  }

  const itemMultiplier = getFirepowerItemMultiplier(entry.itemName, move, attackStatKey);
  return {
    kind: attackStatKey === "attack" ? "physical" : "special",
    entry,
    move,
    value: Math.round(attackValue * move.power * itemMultiplier),
    itemMultiplier,
  };
}

function buildDurabilityCandidate(entry) {
  const actualStats = getResolvedActualStats(entry);
  if (!actualStats) {
    return null;
  }

  const hp = Number(actualStats.hp);
  const defense = Number(actualStats.defense);
  const specialDefense = Number(actualStats.specialDefense);

  if (![hp, defense, specialDefense].every(Number.isFinite)) {
    return null;
  }

  return {
    entry,
    actualStats,
    physical: hp * defense,
    special: hp * specialDefense,
    total: Math.round((hp * defense * specialDefense) / (defense + specialDefense)),
  };
}

function getHighestCandidate(candidates, valueKey) {
  return candidates.reduce(
    (best, candidate) => (candidate && candidate[valueKey] > (best?.[valueKey] ?? -Infinity) ? candidate : best),
    null,
  );
}

export function getBattleTeamIndexSummaries(entries) {
  const firepowerCandidates = entries.flatMap((entry) =>
    (entry.moves ?? [])
      .map((move) => (move ? buildFirepowerCandidate(entry, move) : null))
      .filter(Boolean),
  );
  const durabilityCandidates = entries.map(buildDurabilityCandidate).filter(Boolean);

  return {
    physicalFirepower: getHighestCandidate(
      firepowerCandidates.filter((candidate) => candidate.kind === "physical"),
      "value",
    ),
    specialFirepower: getHighestCandidate(
      firepowerCandidates.filter((candidate) => candidate.kind === "special"),
      "value",
    ),
    totalDurability: getHighestCandidate(durabilityCandidates, "total"),
    physicalDurability: getHighestCandidate(durabilityCandidates, "physical"),
    specialDurability: getHighestCandidate(durabilityCandidates, "special"),
  };
}

export function formatBattleTeamIndexValue(value) {
  return Number.isFinite(value) ? value.toLocaleString("ja-JP") : "—";
}
