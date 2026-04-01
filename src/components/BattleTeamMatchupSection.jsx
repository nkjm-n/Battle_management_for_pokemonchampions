import { getMoveTypeClassName } from "../lib/moveTypeClass";
import { getEntryTypes } from "../lib/pokemonEntryDisplay";
import { POKEMON_TYPE_NAMES, getAttackStatKeyForMove, getTypeEffectivenessMultiplier } from "../lib/pokemonDamage";

const DISPLAY_TYPE_NAMES = POKEMON_TYPE_NAMES.filter((typeName) => typeName !== "ステラ" && typeName !== "不明");

const MATCHUP_ROWS = [
  { key: "super4", label: "抜群", detail: "×4" },
  { key: "super2", label: "抜群", detail: "×2" },
  { key: "normal", label: "通常", detail: "×1" },
  { key: "resisted2", label: "いまいち", detail: "×1/2" },
  { key: "resisted4", label: "いまいち", detail: "×1/4" },
  { key: "none", label: "効果なし", detail: "×0" },
];

function createCountMap() {
  return Object.fromEntries(MATCHUP_ROWS.map((row) => [row.key, 0]));
}

function getMatchupBucketKey(multiplier) {
  if (multiplier === 4) {
    return "super4";
  }

  if (multiplier === 2) {
    return "super2";
  }

  if (multiplier === 0) {
    return "none";
  }

  if (multiplier === 0.25) {
    return "resisted4";
  }

  if (multiplier === 0.5) {
    return "resisted2";
  }

  return "normal";
}

function buildOffensiveMatrix(entries) {
  const attackingMoves = entries.flatMap((entry) =>
    (entry.moves ?? []).filter((move) => move && getAttackStatKeyForMove(move)),
  );

  const countsByType = Object.fromEntries(
    DISPLAY_TYPE_NAMES.map((typeName) => [typeName, createCountMap()]),
  );

  attackingMoves.forEach((move) => {
    DISPLAY_TYPE_NAMES.forEach((typeName) => {
      const multiplier = getTypeEffectivenessMultiplier(move.type, [typeName]);
      const bucketKey = getMatchupBucketKey(multiplier);
      countsByType[typeName][bucketKey] += 1;
    });
  });

  return {
    hasData: attackingMoves.length > 0,
    countsByType,
  };
}

function buildDefensiveMatrix(entries) {
  const countsByType = Object.fromEntries(
    DISPLAY_TYPE_NAMES.map((typeName) => [typeName, createCountMap()]),
  );

  entries.forEach((entry) => {
    const defenderTypes = getEntryTypes(entry);
    DISPLAY_TYPE_NAMES.forEach((typeName) => {
      const multiplier = getTypeEffectivenessMultiplier(typeName, defenderTypes);
      const bucketKey = getMatchupBucketKey(multiplier);
      countsByType[typeName][bucketKey] += 1;
    });
  });

  return {
    hasData: entries.length > 0,
    countsByType,
  };
}

function MatchupTable({ title, description, countsByType, emptyMessage }) {
  return (
    <article className="battle-team-matchup-card">
      <div className="battle-team-matchup-card__header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      {countsByType ? (
        <div className="battle-team-matchup-table-wrap">
          <table className="battle-team-matchup-table">
            <thead>
              <tr>
                <th className="battle-team-matchup-table__corner" scope="col">
                  分類
                </th>
                {DISPLAY_TYPE_NAMES.map((typeName) => (
                  <th key={typeName} className="battle-team-matchup-table__type-heading" scope="col">
                    <span className={`battle-team-matchup-type ${getMoveTypeClassName(typeName)}`.trim()}>
                      {typeName}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATCHUP_ROWS.map((row) => (
                <tr key={row.key}>
                  <th className="battle-team-matchup-table__row-heading" scope="row">
                    <strong>{row.label}</strong>
                    <span>{row.detail}</span>
                  </th>
                  {DISPLAY_TYPE_NAMES.map((typeName) => (
                    <td key={`${row.key}-${typeName}`} className="battle-team-matchup-table__count-cell">
                      <strong>{countsByType[typeName][row.key]}</strong>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-box">{emptyMessage}</div>
      )}
    </article>
  );
}

export default function BattleTeamMatchupSection({ entries }) {
  const offensiveMatchups = buildOffensiveMatrix(entries);
  const defensiveMatchups = buildDefensiveMatrix(entries);

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
          description="横軸はタイプです。各タイプの相手に対して、パーティ内の攻撃技がどの相性になるかを技数で集計しています。"
          countsByType={offensiveMatchups.hasData ? offensiveMatchups.countsByType : null}
          emptyMessage="攻撃技が登録されていません。"
        />
        <MatchupTable
          title="被ダメージ相性"
          description="横軸はタイプです。各タイプの攻撃を受けたときに、パーティ内のポケモンがどの相性になるかを匹数で集計しています。"
          countsByType={defensiveMatchups.hasData ? defensiveMatchups.countsByType : null}
          emptyMessage="ポケモンが登録されていません。"
        />
      </div>
    </section>
  );
}
