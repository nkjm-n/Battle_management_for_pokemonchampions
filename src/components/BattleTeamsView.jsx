import BattleTeamPokemonCard from "./BattleTeamPokemonCard";

const TEAM_SLOT_COUNT = 6;

export default function BattleTeamsView({ battleTeams, savedPokemon, onBack, onSelectTeam }) {
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
              <article
                key={team.id}
                className="battle-team-card battle-team-card--interactive"
                role="button"
                tabIndex={0}
                onClick={() => onSelectTeam?.(team.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectTeam?.(team.id);
                  }
                }}
              >
                <div className="battle-team-card__header">
                  <h2>{team.name}</h2>
                  <span>
                    {team.entries.length} / {TEAM_SLOT_COUNT}
                  </span>
                </div>
                <div className="battle-team-card__grid">
                  {Array.from({ length: TEAM_SLOT_COUNT }, (_, index) => (
                    <BattleTeamPokemonCard
                      key={`${team.id}-slot-${index}`}
                      entry={team.entries[index] ?? null}
                      variant="compact"
                    />
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
