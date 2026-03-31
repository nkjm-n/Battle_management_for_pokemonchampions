import PokemonRadarChart from "./PokemonRadarChart";
import { getMoveTypeClassName } from "../lib/moveTypeClass";
import { MOVE_SLOT_COUNT, getEntryDisplayName, getEntryTypeText } from "../lib/pokemonEntryDisplay";

function BattleTeamMoveTile({ move }) {
  return (
    <article
      className={`battle-team-move ${move ? getMoveTypeClassName(move.type) : "battle-team-move--empty"}`.trim()}
    >
      <strong className="battle-team-move__name">{move?.name ?? "未設定"}</strong>
    </article>
  );
}

export default function BattleTeamPokemonCard({ entry, variant = "compact" }) {
  const moves = Array.from({ length: MOVE_SLOT_COUNT }, (_, index) => entry?.moves?.[index] ?? null);

  if (!entry) {
    return (
      <article
        className={`battle-team-pokemon-card battle-team-pokemon-card--${variant} battle-team-pokemon-card--empty`}
      >
        <div className="battle-team-pokemon-card__empty">空き枠</div>
      </article>
    );
  }

  return (
    <article className={`battle-team-pokemon-card battle-team-pokemon-card--${variant}`}>
      <div className="battle-team-pokemon-card__summary">
        <h3 className="battle-team-pokemon-card__name">{getEntryDisplayName(entry)}</h3>
        <p className="battle-team-pokemon-card__meta">タイプ: {getEntryTypeText(entry)}</p>
        <p className="battle-team-pokemon-card__meta">特性: {entry.abilityName || "—"}</p>
        <p className="battle-team-pokemon-card__meta">持ち物: {entry.itemName || "—"}</p>
      </div>

      {variant === "detail" ? (
        <div className="battle-team-pokemon-card__memo">
          <span className="battle-team-pokemon-card__memo-label">メモ</span>
          <p>{entry.memo || "—"}</p>
        </div>
      ) : null}

      <div className="battle-team-pokemon-card__moves">
        {moves.map((move, index) => (
          <BattleTeamMoveTile key={`${entry.id}-move-${index}`} move={move} />
        ))}
      </div>

      {variant === "detail" ? (
        <PokemonRadarChart
          entry={entry}
          className="trained-card__chart battle-team-pokemon-card__chart"
        />
      ) : null}
    </article>
  );
}
