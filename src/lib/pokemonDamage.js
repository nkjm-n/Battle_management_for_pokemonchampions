import { getNatureMultiplier } from "./natures";

export const DAMAGE_LEVEL = 50;
export const DAMAGE_RANDOM_FACTORS = Array.from({ length: 16 }, (_, index) => 0.85 + index * 0.01);

const TYPE_CHART = {
  ノーマル: { いわ: 0.5, ゴースト: 0, はがね: 0.5 },
  ほのお: { くさ: 2, こおり: 2, むし: 2, はがね: 2, ほのお: 0.5, みず: 0.5, いわ: 0.5, ドラゴン: 0.5 },
  みず: { ほのお: 2, じめん: 2, いわ: 2, みず: 0.5, くさ: 0.5, ドラゴン: 0.5 },
  でんき: { みず: 2, ひこう: 2, でんき: 0.5, くさ: 0.5, ドラゴン: 0.5, じめん: 0 },
  くさ: { みず: 2, じめん: 2, いわ: 2, ほのお: 0.5, くさ: 0.5, どく: 0.5, ひこう: 0.5, むし: 0.5, ドラゴン: 0.5, はがね: 0.5 },
  こおり: { くさ: 2, じめん: 2, ひこう: 2, ドラゴン: 2, ほのお: 0.5, みず: 0.5, こおり: 0.5, はがね: 0.5 },
  かくとう: { ノーマル: 2, こおり: 2, いわ: 2, あく: 2, はがね: 2, どく: 0.5, ひこう: 0.5, エスパー: 0.5, むし: 0.5, フェアリー: 0.5, ゴースト: 0 },
  どく: { くさ: 2, フェアリー: 2, どく: 0.5, じめん: 0.5, いわ: 0.5, ゴースト: 0.5, はがね: 0 },
  じめん: { ほのお: 2, でんき: 2, どく: 2, いわ: 2, はがね: 2, くさ: 0.5, むし: 0.5, ひこう: 0 },
  ひこう: { くさ: 2, かくとう: 2, むし: 2, でんき: 0.5, いわ: 0.5, はがね: 0.5 },
  エスパー: { かくとう: 2, どく: 2, エスパー: 0.5, はがね: 0.5, あく: 0 },
  むし: { くさ: 2, エスパー: 2, あく: 2, ほのお: 0.5, かくとう: 0.5, どく: 0.5, ひこう: 0.5, ゴースト: 0.5, はがね: 0.5, フェアリー: 0.5 },
  いわ: { ほのお: 2, こおり: 2, ひこう: 2, むし: 2, かくとう: 0.5, じめん: 0.5, はがね: 0.5 },
  ゴースト: { エスパー: 2, ゴースト: 2, あく: 0.5, ノーマル: 0 },
  ドラゴン: { ドラゴン: 2, はがね: 0.5, フェアリー: 0 },
  あく: { エスパー: 2, ゴースト: 2, かくとう: 0.5, あく: 0.5, フェアリー: 0.5 },
  はがね: { こおり: 2, いわ: 2, フェアリー: 2, ほのお: 0.5, みず: 0.5, でんき: 0.5, はがね: 0.5 },
  フェアリー: { かくとう: 2, ドラゴン: 2, あく: 2, ほのお: 0.5, どく: 0.5, はがね: 0.5 },
  ステラ: {},
  不明: {},
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function calculateConfiguredStatValue(pokemon, statKey, spValue, natureName) {
  if (!pokemon) {
    return null;
  }

  const base = pokemon.stats[statKey];
  if (statKey === "hp") {
    return base + 15 + spValue + 60;
  }

  return Math.floor((base + 15 + spValue + 5) * getNatureMultiplier(natureName, statKey));
}

export function buildActualStats(pokemon, spValues, natureName) {
  if (!pokemon) {
    return null;
  }

  return {
    hp: calculateConfiguredStatValue(pokemon, "hp", spValues.hp ?? 0, natureName),
    attack: calculateConfiguredStatValue(pokemon, "attack", spValues.attack ?? 0, natureName),
    defense: calculateConfiguredStatValue(pokemon, "defense", spValues.defense ?? 0, natureName),
    specialAttack: calculateConfiguredStatValue(pokemon, "specialAttack", spValues.specialAttack ?? 0, natureName),
    specialDefense: calculateConfiguredStatValue(pokemon, "specialDefense", spValues.specialDefense ?? 0, natureName),
    speed: calculateConfiguredStatValue(pokemon, "speed", spValues.speed ?? 0, natureName),
  };
}

export function getAttackStatKeyForMove(move) {
  if (!move || move.moveKind !== "攻撃技") {
    return null;
  }

  return move.attackClass === "特殊" ? "specialAttack" : move.attackClass === "物理" ? "attack" : null;
}

export function getDefenseStatKeyForMove(move) {
  if (!move || move.moveKind !== "攻撃技") {
    return null;
  }

  return move.attackClass === "特殊" ? "specialDefense" : move.attackClass === "物理" ? "defense" : null;
}

export function getTypeEffectivenessMultiplier(moveType, defenderTypes = []) {
  if (!moveType || !Array.isArray(defenderTypes) || defenderTypes.length === 0) {
    return 1;
  }

  return defenderTypes.reduce((multiplier, defenderType) => {
    const typeValue = TYPE_CHART[moveType]?.[defenderType];
    return multiplier * (typeValue ?? 1);
  }, 1);
}

export function calculateDamageRange({
  attackerPokemon,
  defenderPokemon,
  attackerStats,
  defenderStats,
  move,
  level = DAMAGE_LEVEL,
}) {
  if (!attackerPokemon || !defenderPokemon || !attackerStats || !defenderStats || !move) {
    return null;
  }

  const attackStatKey = getAttackStatKeyForMove(move);
  const defenseStatKey = getDefenseStatKeyForMove(move);

  if (!attackStatKey || !defenseStatKey || !move.power) {
    return {
      isComputable: false,
      message: "変化技または威力固定外の技は未対応です。",
    };
  }

  const attackValue = attackerStats[attackStatKey];
  const defenseValue = Math.max(1, defenderStats[defenseStatKey]);
  const typeEffectiveness = getTypeEffectivenessMultiplier(move.type, defenderPokemon.types);

  if (typeEffectiveness === 0) {
    return {
      isComputable: true,
      move,
      attackStatKey,
      defenseStatKey,
      attackValue,
      defenseValue,
      stabMultiplier: attackerPokemon.types.includes(move.type) ? 1.5 : 1,
      typeEffectiveness,
      damageValues: [0],
      minDamage: 0,
      maxDamage: 0,
      defenderHp: defenderStats.hp,
      minPercent: 0,
      maxPercent: 0,
      maxBarPercent: 0,
      minBarPercent: 0,
    };
  }

  const baseLevelFactor = Math.floor((level * 2) / 5) + 2;
  const baseDamage =
    Math.floor(Math.floor((baseLevelFactor * move.power * attackValue) / defenseValue) / 50) + 2;
  const stabMultiplier = attackerPokemon.types.includes(move.type) ? 1.5 : 1;
  const damageValues = DAMAGE_RANDOM_FACTORS.map((randomFactor) =>
    Math.max(1, Math.floor(baseDamage * stabMultiplier * typeEffectiveness * randomFactor)),
  );
  const minDamage = Math.min(...damageValues);
  const maxDamage = Math.max(...damageValues);
  const defenderHp = Math.max(1, defenderStats.hp);

  return {
    isComputable: true,
    move,
    attackStatKey,
    defenseStatKey,
    attackValue,
    defenseValue,
    stabMultiplier,
    typeEffectiveness,
    damageValues,
    minDamage,
    maxDamage,
    defenderHp,
    minPercent: (minDamage / defenderHp) * 100,
    maxPercent: (maxDamage / defenderHp) * 100,
    maxBarPercent: clamp((maxDamage / defenderHp) * 100, 0, 100),
    minBarPercent: clamp((minDamage / defenderHp) * 100, 0, 100),
  };
}
