import { itemList } from "./data";
import { getNatureMultiplier } from "./natures";

export const DAMAGE_LEVEL = 50;
export const DAMAGE_RANDOM_FACTORS = Array.from({ length: 16 }, (_, index) => 85 + index);

const DAMAGE_SCALE = 4096;
const DAMAGE_MODIFIER_NONE = 4096;
const FIELD_POWER_BOOST = 5325;
const STAB_MODIFIER = 6144;
const ADAPTABILITY_STAB_MODIFIER = 8192;
const CRITICAL_MODIFIER = 6144;
const SPREAD_MODIFIER = 3072;
const SUPER_EFFECTIVE_BELT = 4915;
const LIFE_ORB_MODIFIER = 5324;
const RESIST_BERRY_MODIFIER = 2048;

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

export const POKEMON_TYPE_NAMES = Object.freeze(Object.keys(TYPE_CHART));

const TYPE_IMMUNITY_ABILITIES = {
  ふゆう: ["じめん"],
  ちくでん: ["でんき"],
  でんきエンジン: ["でんき"],
  ひらいしん: ["でんき"],
  そうしょく: ["くさ"],
  ちょすい: ["みず"],
  よびみず: ["みず"],
  かんそうはだ: ["みず"],
  もらいび: ["ほのお"],
  どしょく: ["じめん"],
};

const DOUBLE_ATTACK_ABILITIES = new Set(["ちからもち", "ヨガパワー"]);
const FILTER_ABILITIES = new Set(["フィルター", "ハードロック", "プリズムアーマー"]);
const FIELD_OPTIONS = new Set(["エレキフィールド", "グラスフィールド", "サイコフィールド", "ミストフィールド"]);
const GROUND_WEAKENED_MOVES = new Set(["じしん", "じならし", "マグニチュード"]);
const itemByName = new Map(itemList.map((item) => [item.name, item]));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeEffectText(value) {
  return String(value ?? "").replace(/[ 　]+/g, " ").trim();
}

function roundHalfUp(value) {
  return Math.floor(value + 0.5);
}

function roundHalfDown(value) {
  const flooredValue = Math.floor(value);
  return value - flooredValue > 0.5 ? flooredValue + 1 : flooredValue;
}

function chainModifier(currentModifier, nextModifier) {
  return roundHalfUp((currentModifier * nextModifier) / DAMAGE_SCALE);
}

function combineModifiers(modifiers) {
  return modifiers
    .filter((modifier) => Number.isFinite(modifier) && modifier !== DAMAGE_MODIFIER_NONE)
    .reduce((combinedModifier, modifier) => chainModifier(combinedModifier, modifier), DAMAGE_MODIFIER_NONE);
}

function applyModifier(value, modifier) {
  return roundHalfDown((value * modifier) / DAMAGE_SCALE);
}

function applyStatStage(value, stage) {
  if (!stage) {
    return value;
  }

  if (stage > 0) {
    return Math.floor((value * (2 + stage)) / 2);
  }

  return Math.floor((value * 2) / (2 - stage));
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

function getTypeBoostItemType(itemName) {
  const effectText = normalizeEffectText(itemByName.get(itemName)?.effect);
  const matched = effectText.match(/([^ ]+)タイプの わざの いりょくが あがる/);
  return matched?.[1] ?? null;
}

function getResistBerryType(itemName) {
  const effectText = normalizeEffectText(itemByName.get(itemName)?.effect);
  const matched = effectText.match(/こうかばつぐんの ([^ ]+) わざを うけたとき いりょくが よわまる/);
  return matched?.[1] ?? null;
}

function getPowerModifierContext({
  move,
  attackerAbilityName,
  defenderAbilityName,
  attackerItemName,
  fieldName,
  attackerGrounded,
  defenderGrounded,
}) {
  const modifiers = [];
  const notes = [];

  if (fieldName === "エレキフィールド" && attackerGrounded && move.type === "でんき") {
    modifiers.push(FIELD_POWER_BOOST);
    notes.push("エレキフィールド");
  }

  if (fieldName === "グラスフィールド" && attackerGrounded && move.type === "くさ") {
    modifiers.push(FIELD_POWER_BOOST);
    notes.push("グラスフィールド");
  }

  if (fieldName === "サイコフィールド" && attackerGrounded && move.type === "エスパー") {
    modifiers.push(FIELD_POWER_BOOST);
    notes.push("サイコフィールド");
  }

  if (fieldName === "ミストフィールド" && defenderGrounded && move.type === "ドラゴン") {
    modifiers.push(RESIST_BERRY_MODIFIER);
    notes.push("ミストフィールド");
  }

  if (fieldName === "グラスフィールド" && defenderGrounded && GROUND_WEAKENED_MOVES.has(move.name)) {
    modifiers.push(RESIST_BERRY_MODIFIER);
    notes.push("グラスフィールド");
  }

  if (attackerAbilityName === "テクニシャン" && move.power <= 60) {
    modifiers.push(STAB_MODIFIER);
    notes.push("テクニシャン");
  }

  if (attackerAbilityName === "トランジスタ" && move.type === "でんき") {
    modifiers.push(FIELD_POWER_BOOST);
    notes.push("トランジスタ");
  }

  if (defenderAbilityName === "あついしぼう" && (move.type === "ほのお" || move.type === "こおり")) {
    modifiers.push(RESIST_BERRY_MODIFIER);
    notes.push("あついしぼう");
  }

  if (defenderAbilityName === "たいねつ" && move.type === "ほのお") {
    modifiers.push(RESIST_BERRY_MODIFIER);
    notes.push("たいねつ");
  }

  const boostedType = getTypeBoostItemType(attackerItemName);
  if (boostedType && boostedType === move.type) {
    modifiers.push(SUPER_EFFECTIVE_BELT);
    notes.push(attackerItemName);
  }

  if (attackerItemName === "ちからのハチマキ" && move.attackClass === "物理") {
    modifiers.push(4505);
    notes.push("ちからのハチマキ");
  }

  if (attackerItemName === "ものしりメガネ" && move.attackClass === "特殊") {
    modifiers.push(4505);
    notes.push("ものしりメガネ");
  }

  return {
    modifier: combineModifiers(modifiers),
    notes,
  };
}

function getAttackModifierContext({ attackStatKey, attackerAbilityName, attackerItemName }) {
  const modifiers = [];
  const notes = [];

  if (attackStatKey === "attack" && DOUBLE_ATTACK_ABILITIES.has(attackerAbilityName)) {
    modifiers.push(8192);
    notes.push(attackerAbilityName);
  }

  if (attackStatKey === "attack" && attackerAbilityName === "はりきり") {
    modifiers.push(STAB_MODIFIER);
    notes.push("はりきり");
  }

  if (attackStatKey === "attack" && attackerItemName === "こだわりハチマキ") {
    modifiers.push(STAB_MODIFIER);
    notes.push("こだわりハチマキ");
  }

  if (attackStatKey === "specialAttack" && attackerItemName === "こだわりメガネ") {
    modifiers.push(STAB_MODIFIER);
    notes.push("こだわりメガネ");
  }

  return {
    modifier: combineModifiers(modifiers),
    notes,
  };
}

function getDefenseModifierContext({ defenseStatKey, move, defenderAbilityName, defenderItemName }) {
  const modifiers = [];
  const notes = [];

  if (move.attackClass === "物理" && defenderAbilityName === "ファーコート") {
    modifiers.push(8192);
    notes.push("ファーコート");
  }

  if (defenderItemName === "しんかのきせき") {
    modifiers.push(STAB_MODIFIER);
    notes.push("しんかのきせき");
  }

  if (defenseStatKey === "specialDefense" && defenderItemName === "とつげきチョッキ") {
    modifiers.push(STAB_MODIFIER);
    notes.push("とつげきチョッキ");
  }

  return {
    modifier: combineModifiers(modifiers),
    notes,
  };
}

function getFinalDamageModifierContext({
  move,
  attackerAbilityName,
  defenderAbilityName,
  attackerItemName,
  defenderItemName,
  typeEffectiveness,
  isCritical,
}) {
  const modifiers = [];
  const notes = [];

  if (isCritical && attackerAbilityName === "スナイパー") {
    modifiers.push(STAB_MODIFIER);
    notes.push("スナイパー");
  }

  if (attackerItemName === "いのちのたま") {
    modifiers.push(LIFE_ORB_MODIFIER);
    notes.push("いのちのたま");
  }

  if (attackerItemName === "たつじんのおび" && typeEffectiveness > 1) {
    modifiers.push(SUPER_EFFECTIVE_BELT);
    notes.push("たつじんのおび");
  }

  if (FILTER_ABILITIES.has(defenderAbilityName) && typeEffectiveness > 1) {
    modifiers.push(SPREAD_MODIFIER);
    notes.push(defenderAbilityName);
  }

  const resistBerryType = getResistBerryType(defenderItemName);
  if (resistBerryType && typeEffectiveness > 1 && resistBerryType === move.type) {
    modifiers.push(RESIST_BERRY_MODIFIER);
    notes.push(defenderItemName);
  }

  return {
    modifier: combineModifiers(modifiers),
    notes,
  };
}

function getContextualTypeEffectiveness({
  move,
  attackerAbilityName,
  defenderAbilityName,
  defenderItemName,
  defenderPokemon,
}) {
  if (move.type === "じめん" && defenderItemName === "ふうせん") {
    return {
      typeEffectiveness: 0,
      notes: ["ふうせん"],
    };
  }

  const immuneTypes = TYPE_IMMUNITY_ABILITIES[defenderAbilityName] ?? [];
  if (immuneTypes.includes(move.type)) {
    return {
      typeEffectiveness: 0,
      notes: [defenderAbilityName],
    };
  }

  const baseEffectiveness = getTypeEffectivenessMultiplier(move.type, defenderPokemon.types);
  if (attackerAbilityName === "いろめがね" && baseEffectiveness > 0 && baseEffectiveness < 1) {
    return {
      typeEffectiveness: baseEffectiveness * 2,
      notes: ["いろめがね"],
    };
  }

  return {
    typeEffectiveness: baseEffectiveness,
    notes: [],
  };
}

function getStabModifier(attackerPokemon, move, attackerAbilityName) {
  if (!attackerPokemon?.types?.includes(move.type)) {
    return DAMAGE_MODIFIER_NONE;
  }

  return attackerAbilityName === "てきおうりょく" ? ADAPTABILITY_STAB_MODIFIER : STAB_MODIFIER;
}

function getModifierMultiplier(modifier) {
  return modifier / DAMAGE_SCALE;
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

export function calculateDamageRange({
  attackerPokemon,
  defenderPokemon,
  attackerStats,
  defenderStats,
  move,
  level = DAMAGE_LEVEL,
  attackerAbilityName = "",
  defenderAbilityName = "",
  attackerItemName = "",
  defenderItemName = "",
  attackerStage = 0,
  defenderStage = 0,
  fieldName = "なし",
  attackerGrounded = true,
  defenderGrounded = true,
  isCritical = false,
  isSpread = false,
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

  const typeContext = getContextualTypeEffectiveness({
    move,
    attackerAbilityName,
    defenderAbilityName,
    defenderItemName,
    defenderPokemon,
  });

  if (typeContext.typeEffectiveness === 0) {
    return {
      isComputable: true,
      move,
      attackStatKey,
      defenseStatKey,
      attackValue: attackerStats[attackStatKey],
      defenseValue: defenderStats[defenseStatKey],
      stabMultiplier: getModifierMultiplier(getStabModifier(attackerPokemon, move, attackerAbilityName)),
      typeEffectiveness: 0,
      damageValues: [0],
      minDamage: 0,
      maxDamage: 0,
      defenderHp: defenderStats.hp,
      minPercent: 0,
      maxPercent: 0,
      maxBarPercent: 0,
      minBarPercent: 0,
      modifierNotes: [...typeContext.notes],
    };
  }

  const powerContext = getPowerModifierContext({
    move,
    attackerAbilityName,
    defenderAbilityName,
    attackerItemName,
    fieldName: FIELD_OPTIONS.has(fieldName) ? fieldName : "なし",
    attackerGrounded,
    defenderGrounded,
  });
  const finalPower = Math.max(1, applyModifier(move.power, powerContext.modifier));

  const adjustedAttackerStage = isCritical && attackerStage < 0 ? 0 : attackerStage;
  const adjustedDefenderStage = isCritical && defenderStage > 0 ? 0 : defenderStage;
  const rankedAttackValue = applyStatStage(attackerStats[attackStatKey], adjustedAttackerStage);
  const rankedDefenseValue = applyStatStage(defenderStats[defenseStatKey], adjustedDefenderStage);

  const attackContext = getAttackModifierContext({
    attackStatKey,
    attackerAbilityName,
    attackerItemName,
  });
  const defenseContext = getDefenseModifierContext({
    defenseStatKey,
    move,
    defenderAbilityName,
    defenderItemName,
  });

  const finalAttackValue = Math.max(1, applyModifier(rankedAttackValue, attackContext.modifier));
  const finalDefenseValue = Math.max(1, applyModifier(rankedDefenseValue, defenseContext.modifier));

  const baseLevelFactor = Math.floor((level * 2) / 5) + 2;
  const baseDamage =
    Math.floor(Math.floor((baseLevelFactor * finalPower * finalAttackValue) / finalDefenseValue) / 50) + 2;

  const stabModifier = getStabModifier(attackerPokemon, move, attackerAbilityName);
  const finalDamageContext = getFinalDamageModifierContext({
    move,
    attackerAbilityName,
    defenderAbilityName,
    attackerItemName,
    defenderItemName,
    typeEffectiveness: typeContext.typeEffectiveness,
    isCritical,
  });

  const damageValues = DAMAGE_RANDOM_FACTORS.map((randomFactor) => {
    let nextDamage = baseDamage;

    if (isSpread) {
      nextDamage = Math.max(1, applyModifier(nextDamage, SPREAD_MODIFIER));
    }

    if (isCritical) {
      nextDamage = Math.max(1, applyModifier(nextDamage, CRITICAL_MODIFIER));
    }

    nextDamage = Math.floor((nextDamage * randomFactor) / 100);
    nextDamage = Math.max(1, applyModifier(nextDamage, stabModifier));
    nextDamage = Math.floor(nextDamage * typeContext.typeEffectiveness);
    nextDamage = Math.max(1, applyModifier(nextDamage, finalDamageContext.modifier));

    return Math.max(1, nextDamage);
  });

  const minDamage = Math.min(...damageValues);
  const maxDamage = Math.max(...damageValues);
  const defenderHp = Math.max(1, defenderStats.hp);
  const modifierNotes = Array.from(
    new Set([
      ...powerContext.notes,
      ...attackContext.notes,
      ...defenseContext.notes,
      ...typeContext.notes,
      ...finalDamageContext.notes,
      ...(isCritical ? ["急所"] : []),
      ...(isSpread ? ["複数対象"] : []),
    ]),
  );

  return {
    isComputable: true,
    move,
    attackStatKey,
    defenseStatKey,
    attackValue: finalAttackValue,
    defenseValue: finalDefenseValue,
    stabMultiplier: getModifierMultiplier(stabModifier),
    typeEffectiveness: typeContext.typeEffectiveness,
    damageValues,
    minDamage,
    maxDamage,
    defenderHp,
    minPercent: (minDamage / defenderHp) * 100,
    maxPercent: (maxDamage / defenderHp) * 100,
    maxBarPercent: clamp((maxDamage / defenderHp) * 100, 0, 100),
    minBarPercent: clamp((minDamage / defenderHp) * 100, 0, 100),
    modifierNotes,
  };
}
