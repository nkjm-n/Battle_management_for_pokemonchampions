import { getPokemonRecordByName } from "./data";

export const MOVE_SLOT_COUNT = 4;

export function getEntryDisplayName(entry) {
  const nickname = entry?.nickname?.trim();
  return nickname ? `${entry.pokemonName}【${nickname}】` : entry?.pokemonName ?? "未登録";
}

export function getEntryTypes(entry) {
  return getPokemonRecordByName(entry?.pokemonName)?.types ?? [];
}

export function getEntryTypeText(entry) {
  const types = getEntryTypes(entry);
  return types.length > 0 ? types.join(" / ") : "—";
}
