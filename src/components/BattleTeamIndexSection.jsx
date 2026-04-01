import { itemList, getPokemonRecordByName } from "../lib/data";
import { buildActualStats, getAttackStatKeyForMove } from "../lib/pokemonDamage";
import { getEntryDisplayName } from "../lib/pokemonEntryDisplay";

const itemByName = new Map(itemList.map((item) => [item.name, item]));

function normalizeEffectText(value) {
  return String(value ?? "").replace(/[ 　]+/g, " ").trim();
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

function getIndexSummaries(entries) {
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

function formatIndexValue(value) {
  return Number.isFinite(value) ? value.toLocaleString("ja-JP") : "—";
}

function FirepowerCard({ title, summary }) {
  return (
    <article className="battle-team-index-card">
      <p className="battle-team-index-card__title">{title}</p>
      <strong className="battle-team-index-card__value">{formatIndexValue(summary?.value)}</strong>
      {summary ? (
        <div className="battle-team-index-card__meta">
          <span>{getEntryDisplayName(summary.entry)}</span>
          <span>わざ: {summary.move.name}</span>
          <span>
            持ち物: {summary.entry.itemName || "なし"}
            {summary.itemMultiplier > 1 ? ` ×${summary.itemMultiplier}` : ""}
          </span>
        </div>
      ) : (
        <p className="battle-team-index-card__empty">対象の攻撃技がありません。</p>
      )}
    </article>
  );
}

function DurabilityCard({ title, summary, valueKey }) {
  return (
    <article className="battle-team-index-card">
      <p className="battle-team-index-card__title">{title}</p>
      <strong className="battle-team-index-card__value">{formatIndexValue(summary?.[valueKey])}</strong>
      {summary ? (
        <div className="battle-team-index-card__meta">
          <span>{getEntryDisplayName(summary.entry)}</span>
          <span>
            HP {summary.actualStats.hp} / 防御 {summary.actualStats.defense} / 特防 {summary.actualStats.specialDefense}
          </span>
        </div>
      ) : (
        <p className="battle-team-index-card__empty">計算できるポケモンがありません。</p>
      )}
    </article>
  );
}

export default function BattleTeamIndexSection({ entries }) {
  const summaries = getIndexSummaries(entries);

  return (
    <section className="panel panel--soft battle-team-index">
      <div className="section-heading">
        <div>
          <p className="section-heading__eyebrow">Index</p>
          <h2>指数</h2>
        </div>
      </div>

      <div className="battle-team-index__grid battle-team-index__grid--firepower">
        <FirepowerCard title="最大物理火力指数" summary={summaries.physicalFirepower} />
        <FirepowerCard title="最大特殊火力指数" summary={summaries.specialFirepower} />
      </div>

      <div className="battle-team-index__grid battle-team-index__grid--durability">
        <DurabilityCard title="最大合計耐久指数" summary={summaries.totalDurability} valueKey="total" />
        <DurabilityCard title="最大物理耐久指数" summary={summaries.physicalDurability} valueKey="physical" />
        <DurabilityCard title="最大特殊耐久指数" summary={summaries.specialDurability} valueKey="special" />
      </div>
    </section>
  );
}
