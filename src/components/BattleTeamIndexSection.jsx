import { getEntryDisplayName } from "../lib/pokemonEntryDisplay";
import { formatBattleTeamIndexValue, getBattleTeamIndexSummaries } from "../lib/battleTeamSummary";

function FirepowerCard({ title, summary }) {
  return (
    <article className="battle-team-index-card">
      <div className="battle-team-index-card__body">
        <div className="battle-team-index-card__metric">
          <p className="battle-team-index-card__title">{title}</p>
          <strong className="battle-team-index-card__value">{formatBattleTeamIndexValue(summary?.value)}</strong>
        </div>

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
      </div>
    </article>
  );
}

function DurabilityCard({ title, summary, valueKey }) {
  return (
    <article className="battle-team-index-card">
      <div className="battle-team-index-card__body">
        <div className="battle-team-index-card__metric">
          <p className="battle-team-index-card__title">{title}</p>
          <strong className="battle-team-index-card__value">{formatBattleTeamIndexValue(summary?.[valueKey])}</strong>
        </div>

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
      </div>
    </article>
  );
}

export default function BattleTeamIndexSection({ entries }) {
  const summaries = getBattleTeamIndexSummaries(entries);

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
