import { getMoveTypeClassName } from "../lib/moveTypeClass";
import { getEntryDisplayName, getEntryTypes } from "../lib/pokemonEntryDisplay";
import { POKEMON_TYPE_NAMES, getAttackStatKeyForMove, getTypeEffectivenessMultiplier } from "../lib/pokemonDamage";

const MATCHUP_COLUMNS = [
  { key: "super", label: "抜群", detail: "×2・×4" },
  { key: "normal", label: "通常", detail: "×1" },
  { key: "resisted", label: "いまいち", detail: "×1/2・×1/4" },
  { key: "none", label: "効果なし", detail: "×0" },
];

function createEmptyBuckets() {
  return {
    super: [],
    normal: [],
    resisted: [],
    none: [],
  };
}

function getMatchupBucketKey(multiplier) {
  if (multiplier === 0) {
    return "none";
  }

  if (multiplier > 1) {
    return "super";
  }

  if (multiplier < 1) {
    return "resisted";
  }

  return "normal";
}

function formatMultiplier(multiplier) {
  if (multiplier === 0) {
    return "×0";
  }

  if (multiplier === 0.25) {
    return "×1/4";
  }

  if (multiplier === 0.5) {
    return "×1/2";
  }

  if (multiplier === 1) {
    return "×1";
  }

  if (multiplier === 2) {
    return "×2";
  }

  if (multiplier === 4) {
    return "×4";
  }

  return `×${multiplier}`;
}

function buildOffensiveRows(entries) {
  const attackingMoves = entries.flatMap((entry) =>
    (entry.moves ?? [])
      .map((move, index) => ({ move, index }))
      .filter(({ move }) => move && getAttackStatKeyForMove(move))
      .map((move) => ({
        id: `${entry.id}-${move.index}-${move.move.name}`,
        ownerName: getEntryDisplayName(entry),
        moveName: move.move.name,
        moveType: move.move.type,
      })),
  );

  return {
    hasData: attackingMoves.length > 0,
    rows: POKEMON_TYPE_NAMES.map((typeName) => {
      const buckets = createEmptyBuckets();

      attackingMoves.forEach((moveEntry) => {
        const multiplier = getTypeEffectivenessMultiplier(moveEntry.moveType, [typeName]);
        const bucketKey = getMatchupBucketKey(multiplier);
        buckets[bucketKey].push({
          id: `${moveEntry.id}-${typeName}`,
          primary: moveEntry.moveName,
          secondary: moveEntry.ownerName,
          multiplier: formatMultiplier(multiplier),
        });
      });

      return {
        typeName,
        buckets,
      };
    }),
  };
}

function buildDefensiveRows(entries) {
  return {
    hasData: entries.length > 0,
    rows: POKEMON_TYPE_NAMES.map((typeName) => {
      const buckets = createEmptyBuckets();

      entries.forEach((entry) => {
        const multiplier = getTypeEffectivenessMultiplier(typeName, getEntryTypes(entry));
        const bucketKey = getMatchupBucketKey(multiplier);
        buckets[bucketKey].push({
          id: `${entry.id}-${typeName}`,
          primary: getEntryDisplayName(entry),
          secondary: getEntryTypes(entry).join(" / ") || "—",
          multiplier: formatMultiplier(multiplier),
        });
      });

      return {
        typeName,
        buckets,
      };
    }),
  };
}

function MatchupChip({ item }) {
  return (
    <div className="battle-team-matchup-chip">
      <strong>{item.primary}</strong>
      <span>{item.secondary}</span>
      <small>{item.multiplier}</small>
    </div>
  );
}

function MatchupTable({ title, description, rows, emptyMessage }) {
  return (
    <article className="battle-team-matchup-card">
      <div className="battle-team-matchup-card__header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      {rows.length === 0 ? (
        <div className="empty-box">{emptyMessage}</div>
      ) : (
        <div className="battle-team-matchup-table">
          <div className="battle-team-matchup-table__head">
            <div className="battle-team-matchup-table__type-heading">タイプ</div>
            {MATCHUP_COLUMNS.map((column) => (
              <div key={column.key} className="battle-team-matchup-table__column-heading">
                <strong>{column.label}</strong>
                <span>{column.detail}</span>
              </div>
            ))}
          </div>

          <div className="battle-team-matchup-table__body">
            {rows.map((row) => (
              <div key={row.typeName} className="battle-team-matchup-table__row">
                <div className="battle-team-matchup-table__type-cell">
                  <span className={`battle-team-matchup-type ${getMoveTypeClassName(row.typeName)}`.trim()}>
                    {row.typeName}
                  </span>
                </div>

                {MATCHUP_COLUMNS.map((column) => (
                  <div
                    key={`${row.typeName}-${column.key}`}
                    className="battle-team-matchup-table__cell"
                    data-label={`${column.label} ${column.detail}`}
                  >
                    {row.buckets[column.key].length > 0 ? (
                      <div className="battle-team-matchup-table__chip-list">
                        {row.buckets[column.key].map((item) => (
                          <MatchupChip key={item.id} item={item} />
                        ))}
                      </div>
                    ) : (
                      <span className="battle-team-matchup-table__empty">—</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default function BattleTeamMatchupSection({ entries }) {
  const offensiveMatchups = buildOffensiveRows(entries);
  const defensiveMatchups = buildDefensiveRows(entries);

  return (
    <section className="panel panel--soft battle-team-matchup">
      <div className="section-heading">
        <div>
          <p className="section-heading__eyebrow">Matchup</p>
          <h2>パーティ相性</h2>
        </div>
      </div>

      <div className="battle-team-matchup__grid">
        <MatchupTable
          title="与ダメージ相性"
          description="パーティ内の攻撃技が、各タイプの相手にどう通るかを分類しています。"
          rows={offensiveMatchups.hasData ? offensiveMatchups.rows : []}
          emptyMessage="攻撃技が登録されていません。"
        />
        <MatchupTable
          title="被ダメージ相性"
          description="各タイプの攻撃を受けたときに、パーティの誰が弱点・半減・無効かを分類しています。"
          rows={defensiveMatchups.hasData ? defensiveMatchups.rows : []}
          emptyMessage="ポケモンが登録されていません。"
        />
      </div>
    </section>
  );
}
