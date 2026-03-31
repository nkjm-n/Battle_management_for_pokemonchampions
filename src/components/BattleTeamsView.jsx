import { getMoveTypeClassName } from "../lib/moveTypeClass";

const TEAM_SLOT_COUNT = 6;
const MOVE_SLOT_COUNT = 4;

function getEntryDisplayName(entry) {
  const nickname = entry?.nickname?.trim();
  return nickname ? `${entry.pokemonName}【${nickname}】` : entry?.pokemonName ?? "未登録";
}

function TeamMoveTile({ move, index }) {
  return (
    <article
      className={`battle-team-move ${move ? getMoveTypeClassName(move.type) : "battle-team-move--empty"}`.trim()}
    >
      <span className="battle-team-move__slot">技{index + 1}</span>
      <strong className="battle-team-move__name">{move?.name ?? "未設定"}</strong>
    </article>
  );
}

function TeamPokemonCard({ entry }) {
  const moves = Array.from({ length: MOVE_SLOT_COUNT }, (_, index) => entry?.moves?.[index] ?? null);

  return (
    <article className={`battle-team-pokemon-card ${entry ? "" : "battle-team-pokemon-card--empty"}`.trim()}>
      {entry ? (
        <>
          <h3 className="battle-team-pokemon-card__name">{getEntryDisplayName(entry)}</h3>
          <p className="battle-team-pokemon-card__meta">特性: {entry.abilityName || "—"}</p>
          <p className="battle-team-pokemon-card__meta">持ち物: {entry.itemName || "—"}</p>
          <div className="battle-team-pokemon-card__moves">
            {moves.map((move, index) => (
              <TeamMoveTile key={`${entry.id}-move-${index}`} move={move} index={index} />
            ))}
          </div>
        </>
      ) : (
        <div className="battle-team-pokemon-card__empty">空き枠</div>
      )}
    </article>
  );
}

export default function BattleTeamsView({ battleTeams, savedPokemon, onBack }) {
  const teams = battleTeams.map((team) => ({
    ...team,
    entries: team.pokemonIds
      .map((pokemonId) => savedPokemon.find((entry) => entry.id === pokemonId) ?? null)
      .filter((entry) => entry !== null),
  }));

  return (
    <div className="view-shell">
      <header className="topbar">
        <button className="ghost-button" type="button" onClick={onBack}>
          ホームへ戻る
        </button>
        <div className="topbar__meta">
          <strong>バトルチーム</strong>
        </div>
      </header>

      <section className="panel panel--soft">
        {teams.length === 0 ? (
          <div className="empty-box">登録されたバトルチームはまだありません。</div>
        ) : (
          <div className="battle-team-list">
            {teams.map((team) => (
              <article key={team.id} className="battle-team-card">
                <div className="battle-team-card__header">
                  <h2>{team.name}</h2>
                  <span>{team.entries.length} / {TEAM_SLOT_COUNT}</span>
                </div>
                <div className="battle-team-card__grid">
                  {Array.from({ length: TEAM_SLOT_COUNT }, (_, index) => (
                    <TeamPokemonCard key={`${team.id}-slot-${index}`} entry={team.entries[index] ?? null} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
