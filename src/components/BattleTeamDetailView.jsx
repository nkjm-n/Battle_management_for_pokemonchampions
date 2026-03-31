import BattleTeamPokemonCard from "./BattleTeamPokemonCard";

const TEAM_SLOT_COUNT = 6;

export default function BattleTeamDetailView({ team, savedPokemon, onBack }) {
  const entries = team
    ? team.pokemonIds
        .map((pokemonId) => savedPokemon.find((entry) => entry.id === pokemonId) ?? null)
        .filter((entry) => entry !== null)
    : [];

  return (
    <div className="view-shell">
      <header className="topbar">
        <button className="ghost-button" type="button" onClick={onBack}>
          チーム一覧へ戻る
        </button>
        <div className="topbar__meta">
          <strong>{team?.name ?? "バトルチーム"}</strong>
          {team ? <span>{entries.length} / {TEAM_SLOT_COUNT}</span> : null}
        </div>
      </header>

      <section className="panel panel--soft">
        {team ? (
          <div className="battle-team-detail__grid">
            {Array.from({ length: TEAM_SLOT_COUNT }, (_, index) => (
              <BattleTeamPokemonCard
                key={`${team.id}-detail-slot-${index}`}
                entry={entries[index] ?? null}
                variant="detail"
              />
            ))}
          </div>
        ) : (
          <div className="empty-box">選択されたバトルチームが見つかりませんでした。</div>
        )}
      </section>
    </div>
  );
}
