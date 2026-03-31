export const moveTypeClassMap = {
  ノーマル: "normal",
  ほのお: "fire",
  みず: "water",
  でんき: "electric",
  くさ: "grass",
  こおり: "ice",
  かくとう: "fighting",
  どく: "poison",
  じめん: "ground",
  ひこう: "flying",
  エスパー: "psychic",
  むし: "bug",
  いわ: "rock",
  ゴースト: "ghost",
  ドラゴン: "dragon",
  あく: "dark",
  はがね: "steel",
  フェアリー: "fairy",
  ステラ: "stellar",
  不明: "unknown",
};

export function getMoveTypeClassName(typeName) {
  const typeClass = moveTypeClassMap[typeName];
  return typeClass ? `move-card--type-${typeClass}` : "";
}
