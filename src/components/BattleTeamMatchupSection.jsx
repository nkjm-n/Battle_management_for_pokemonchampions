import { getMoveTypeClassName } from "../lib/moveTypeClass";
import {
  BATTLE_TEAM_DISPLAY_TYPE_NAMES,
  BATTLE_TEAM_MATCHUP_ROWS,
  buildBattleTeamDefensiveMatrix,
  buildBattleTeamOffensiveMatrix,
} from "../lib/battleTeamSummary";

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
                {BATTLE_TEAM_DISPLAY_TYPE_NAMES.map((typeName) => (
                  <th key={typeName} className="battle-team-matchup-table__type-heading" scope="col">
                    <span className={`battle-team-matchup-type ${getMoveTypeClassName(typeName)}`.trim()}>
                      {typeName}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BATTLE_TEAM_MATCHUP_ROWS.map((row) => (
                <tr key={row.key} className={`battle-team-matchup-table__row battle-team-matchup-table__row--${row.key}`}>
                  <th className="battle-team-matchup-table__row-heading" scope="row">
                    <strong>{row.label}</strong>
                    <span>{row.detail}</span>
                  </th>
                  {BATTLE_TEAM_DISPLAY_TYPE_NAMES.map((typeName) => (
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
  const offensiveMatchups = buildBattleTeamOffensiveMatrix(entries);
  const defensiveMatchups = buildBattleTeamDefensiveMatrix(entries);

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
