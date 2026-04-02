import { getMoveTypeClassName } from "../lib/moveTypeClass";
import { getEntryDisplayName } from "../lib/pokemonEntryDisplay";
import {
  BATTLE_TEAM_DISPLAY_TYPE_NAMES,
  buildBattleTeamDefensiveMatrix,
  buildBattleTeamOffensiveMatrix,
  formatBattleTeamIndexValue,
  getBattleTeamIndexSummaries,
} from "../lib/battleTeamSummary";

const COMPACT_MATCHUP_ROWS = [
  {
    key: "offense-super",
    label: "攻抜群",
    countResolver: (counts) => counts.super4 + counts.super2,
  },
  {
    key: "offense-none",
    label: "攻無効",
    countResolver: (counts) => counts.none,
  },
  {
    key: "defense-super",
    label: "受弱点",
    countResolver: (counts) => counts.super4 + counts.super2,
  },
  {
    key: "defense-resist",
    label: "受半減以下",
    countResolver: (counts) => counts.resisted4 + counts.resisted2 + counts.none,
  },
];

const INDEX_ITEMS = [
  {
    key: "physicalFirepower",
    title: "物理火力指数",
    valueKey: "value",
    detail: (summary) => `${getEntryDisplayName(summary.entry)}\nわざ: ${summary.move.name}`,
  },
  {
    key: "specialFirepower",
    title: "特殊火力指数",
    valueKey: "value",
    detail: (summary) => `${getEntryDisplayName(summary.entry)}\nわざ: ${summary.move.name}`,
  },
  { key: "totalDurability", title: "合計耐久指数", valueKey: "total", detail: (summary) => getEntryDisplayName(summary.entry) },
  { key: "physicalDurability", title: "物理耐久指数", valueKey: "physical", detail: (summary) => getEntryDisplayName(summary.entry) },
  { key: "specialDurability", title: "特殊耐久指数", valueKey: "special", detail: (summary) => getEntryDisplayName(summary.entry) },
];

function MatchupTypeBadge({ typeName, count }) {
  return (
    <span className={`battle-team-swap-summary__type-badge ${getMoveTypeClassName(typeName)}`.trim()}>
      <span>{typeName}</span>
      <strong>{count}</strong>
    </span>
  );
}

function CompactMatchupRow({ label, typeCounts }) {
  return (
    <div className="battle-team-swap-summary__matchup-row">
      <strong className="battle-team-swap-summary__matchup-label">{label}</strong>
      {typeCounts.length > 0 ? (
        <div className="battle-team-swap-summary__type-list">
          {typeCounts.map(([typeName, count]) => (
            <MatchupTypeBadge key={`${label}-${typeName}`} typeName={typeName} count={count} />
          ))}
        </div>
      ) : (
        <span className="battle-team-swap-summary__empty">該当なし</span>
      )}
    </div>
  );
}

function CompactIndexCard({ title, summary, valueKey, detail }) {
  return (
    <article className="battle-team-swap-summary__index-card">
      <span className="battle-team-swap-summary__index-title">{title}</span>
      <strong className="battle-team-swap-summary__index-value">
        {formatBattleTeamIndexValue(summary?.[valueKey])}
      </strong>
      <span className="battle-team-swap-summary__index-meta">
        {summary ? detail(summary) : "未計算"}
      </span>
    </article>
  );
}

export default function BattleTeamSwapSummaryPanel({ entries }) {
  const offensiveMatchups = buildBattleTeamOffensiveMatrix(entries);
  const defensiveMatchups = buildBattleTeamDefensiveMatrix(entries);
  const indexSummaries = getBattleTeamIndexSummaries(entries);

  const compactRows = COMPACT_MATCHUP_ROWS.map((row) => {
    const sourceCountsByType =
      row.key.startsWith("offense-") ? offensiveMatchups.countsByType : defensiveMatchups.countsByType;

    const typeCounts = BATTLE_TEAM_DISPLAY_TYPE_NAMES.map((typeName) => [
      typeName,
      row.countResolver(sourceCountsByType[typeName]),
    ]).filter(([, count]) => count > 0);

    return {
      ...row,
      typeCounts,
    };
  });

  return (
    <section className="panel panel--soft battle-team-swap-summary">
      <div className="battle-team-swap-summary__layout">
        <article className="battle-team-swap-summary__panel">
          <div className="battle-team-swap-summary__panel-header">
            <h3>タイプ相性表</h3>
          </div>

          {entries.length > 0 ? (
            <div className="battle-team-swap-summary__matchups">
              {compactRows.map((row) => (
                <CompactMatchupRow key={row.key} label={row.label} typeCounts={row.typeCounts} />
              ))}
            </div>
          ) : (
            <div className="empty-box">ポケモンを追加すると相性が表示されます。</div>
          )}
        </article>

        <article className="battle-team-swap-summary__panel">
          <div className="battle-team-swap-summary__panel-header">
            <h3>指数</h3>
          </div>

          <div className="battle-team-swap-summary__index-layout">
            <div className="battle-team-swap-summary__index-row">
              {INDEX_ITEMS.slice(0, 2).map((item) => (
                <CompactIndexCard
                  key={item.key}
                  title={item.title}
                  summary={indexSummaries[item.key]}
                  valueKey={item.valueKey}
                  detail={item.detail}
                />
              ))}
            </div>
            <div className="battle-team-swap-summary__index-row battle-team-swap-summary__index-row--single">
              <CompactIndexCard
                key={INDEX_ITEMS[2].key}
                title={INDEX_ITEMS[2].title}
                summary={indexSummaries[INDEX_ITEMS[2].key]}
                valueKey={INDEX_ITEMS[2].valueKey}
                detail={INDEX_ITEMS[2].detail}
              />
            </div>
            <div className="battle-team-swap-summary__index-row">
              {INDEX_ITEMS.slice(3).map((item) => (
                <CompactIndexCard
                  key={item.key}
                  title={item.title}
                  summary={indexSummaries[item.key]}
                  valueKey={item.valueKey}
                  detail={item.detail}
                />
              ))}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
