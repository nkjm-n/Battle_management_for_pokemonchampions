export const statsOrder = [
  { key: "attack", label: "攻撃" },
  { key: "defense", label: "防御" },
  { key: "specialAttack", label: "特攻" },
  { key: "specialDefense", label: "特防" },
  { key: "speed", label: "すばやさ" },
];

export const neutralNatureNames = ["がんばりや", "てれや", "すなお", "きまぐれ", "まじめ"];

export const natures = [
  { name: "さみしがり", up: "attack", down: "defense" },
  { name: "いじっぱり", up: "attack", down: "specialAttack" },
  { name: "やんちゃ", up: "attack", down: "specialDefense" },
  { name: "ゆうかん", up: "attack", down: "speed" },
  { name: "ずぶとい", up: "defense", down: "attack" },
  { name: "わんぱく", up: "defense", down: "specialAttack" },
  { name: "のうてんき", up: "defense", down: "specialDefense" },
  { name: "のんき", up: "defense", down: "speed" },
  { name: "ひかえめ", up: "specialAttack", down: "attack" },
  { name: "おっとり", up: "specialAttack", down: "defense" },
  { name: "うっかりや", up: "specialAttack", down: "specialDefense" },
  { name: "れいせい", up: "specialAttack", down: "speed" },
  { name: "おだやか", up: "specialDefense", down: "attack" },
  { name: "おとなしい", up: "specialDefense", down: "defense" },
  { name: "しんちょう", up: "specialDefense", down: "specialAttack" },
  { name: "なまいき", up: "specialDefense", down: "speed" },
  { name: "おくびょう", up: "speed", down: "attack" },
  { name: "せっかち", up: "speed", down: "defense" },
  { name: "ようき", up: "speed", down: "specialAttack" },
  { name: "むじゃき", up: "speed", down: "specialDefense" },
  ...neutralNatureNames.map((name) => ({ name, up: null, down: null })),
];

export const natureMap = Object.fromEntries(natures.map((nature) => [nature.name, nature]));

export const natureMatrix = statsOrder.reduce((accumulator, rowStat) => {
  accumulator[rowStat.key] = statsOrder.reduce((rowAccumulator, columnStat) => {
    rowAccumulator[columnStat.key] =
      natures.find((nature) => nature.up === columnStat.key && nature.down === rowStat.key) ?? null;
    return rowAccumulator;
  }, {});
  return accumulator;
}, {});

export function getNatureMultiplier(natureName, statKey) {
  const nature = natureMap[natureName];
  if (!nature || !nature.up || !nature.down) {
    return 1;
  }

  if (nature.up === statKey) {
    return 1.1;
  }

  if (nature.down === statKey) {
    return 0.9;
  }

  return 1;
}
