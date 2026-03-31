import itemMarkdown from "../../item.md?raw";
import moveMarkdown from "../../move.md?raw";
import pokemonMarkdown from "../../pokemon.md?raw";
import pokemonTypes from "./pokemonTypes.json";

function parseMarkdownRow(row) {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function splitMultilineCell(value) {
  if (!value || value === "なし") {
    return [];
  }

  return value
    .split("<br>")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePokemonMarkdown(markdown) {
  const rows = markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| "))
    .slice(2);

  return rows.map((row) => {
    const [
      name,
      hp,
      attack,
      defense,
      specialAttack,
      specialDefense,
      speed,
      abilitiesRaw,
      abilityEffectsRaw,
      hiddenAbility,
      hiddenAbilityEffect,
    ] = parseMarkdownRow(row);

    const abilityEffects = splitMultilineCell(abilityEffectsRaw);
    const abilities = splitMultilineCell(abilitiesRaw).map((abilityName, index) => ({
      name: abilityName,
      effect: abilityEffects[index] ?? "",
      isHidden: false,
    }));

    const hiddenAbilityEntry =
      hiddenAbility && hiddenAbility !== "なし"
        ? {
            name: hiddenAbility,
            effect: hiddenAbilityEffect === "なし" ? "" : hiddenAbilityEffect,
            isHidden: true,
          }
        : null;

    return {
      name,
      types: pokemonTypes[name] ?? [],
      stats: {
        hp: Number(hp),
        attack: Number(attack),
        defense: Number(defense),
        specialAttack: Number(specialAttack),
        specialDefense: Number(specialDefense),
        speed: Number(speed),
      },
      abilities,
      hiddenAbility: hiddenAbilityEntry,
      abilityOptions: hiddenAbilityEntry ? [...abilities, hiddenAbilityEntry] : abilities,
    };
  });
}

function parseItemMarkdown(markdown) {
  const rows = markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| "))
    .slice(2);

  return rows.map((row) => {
    const [id, name, pocket, cost, effect] = parseMarkdownRow(row);
    return {
      id: Number(id),
      name,
      pocket,
      cost: Number(cost),
      effect,
    };
  });
}

function parseMoveMarkdown(markdown) {
  const rows = markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| "))
    .slice(2);

  return rows.map((row) => {
    const [id, name, type, moveKind, attackClass, power, pp, effect] = parseMarkdownRow(row);
    return {
      id: Number(id),
      name,
      type,
      moveKind,
      attackClass,
      power: power === "—" ? null : Number(power),
      pp: Number(pp),
      effect,
    };
  });
}

export const pokemonList = parsePokemonMarkdown(pokemonMarkdown);
export const itemList = parseItemMarkdown(itemMarkdown);
export const moveList = parseMoveMarkdown(moveMarkdown);
export const pokemonByName = new Map(pokemonList.map((pokemon) => [pokemon.name, pokemon]));

export function getPokemonRecordByName(name) {
  return pokemonByName.get(name) ?? null;
}
