import BattleTeamPokemonCard from "./BattleTeamPokemonCard";

const TEAM_SLOT_COUNT = 6;

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v8h-2v-8Zm4 0h2v8h-2v-8ZM7 10h2v8H7v-8Zm-1 12-1-14h14l-1 14H6Z" />
    </svg>
  );
}

export default function BattleTeamsView({
  battleTeams,
  savedPokemon,
  onBack,
  onDeleteTeam,
  onSelectTeam,
}) {
  const teams = battleTeams.map((team) => ({
    ...team,
    entries: team.pokemonIds
      .map((pokemonId) => savedPokemon.find((entry) => entry.id === pokemonId) ?? null)
      .filter((entry) => entry !== null),
  }));

  function handleDelete(team, event) {
    event.stopPropagation();

    const shouldDelete = window.confirm(`${team.name} を削除しますか？`);
    if (!shouldDelete) {
      return;
    }

    onDeleteTeam?.(team.id);
  }

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
                  <div className="battle-team-card__header-actions">
                    <span>
                      {team.entries.length} / {TEAM_SLOT_COUNT}
                    </span>
                    <button
                      className="battle-team-card__delete-button"
                      type="button"
                      aria-label={`${team.name} を削除`}
                      onClick={(event) => handleDelete(team, event)}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
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
