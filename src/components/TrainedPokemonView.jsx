import PokemonRadarChart from "./PokemonRadarChart";
import { getMoveTypeClassName } from "../lib/moveTypeClass";
import { MOVE_SLOT_COUNT, getEntryDisplayName } from "../lib/pokemonEntryDisplay";


function SavedMoveCard({ move, index }) {
  return (
    <article className={`move-card ${move ? getMoveTypeClassName(move.type) : "move-card--empty"}`.trim()}>
      <div className="move-card__saved-header">
        <span className="move-card__slot-label">技{index + 1}</span>
        <strong className="move-card__saved-name">{move?.name ?? "未設定"}</strong>
      </div>

      {move ? (
        <div className="move-card__details">
          <p className="move-card__detail-line">
            <span>タイプ</span>
            <strong>{move.type}</strong>
          </p>
          <p className="move-card__detail-line">
            <span>技の種類</span>
            <strong>{move.moveKind}</strong>
          </p>
          {move.moveKind === "攻撃技" ? (
            <p className="move-card__detail-line">
              <span>分類 / 威力</span>
              <strong>
                {move.attackClass} / {move.power ?? "—"}
              </strong>
            </p>
          ) : null}
          <p className="move-card__detail-line">
            <span>PP</span>
            <strong>{move.pp ?? "—"}</strong>
          </p>
          <p className="move-card__effect">{move.effect || "効果なし"}</p>
        </div>
      ) : (
        <p className="move-card__empty-text">登録なし</p>
      )}
    </article>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v8h-2v-8Zm4 0h2v8h-2v-8ZM7 10h2v8H7v-8Zm-1 12-1-14h14l-1 14H6Z" />
    </svg>
  );
}

export default function TrainedPokemonView({ savedPokemon, onBack, onEdit, onDelete }) {
  const savedEntries = [...savedPokemon].sort(
    (left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime(),
  );

  function handleDelete(entry) {
    if (!onDelete) {
      return;
    }

    const shouldDelete = window.confirm(`${getEntryDisplayName(entry)} を削除しますか？`);
    if (!shouldDelete) {
      return;
    }

    onDelete(entry.id);
  }

  function handleEdit(entry) {
    onEdit?.(entry.id);
  }

  return (
    <div className="view-shell">
      <header className="topbar">
        <button className="ghost-button" type="button" onClick={onBack}>
          ホームへ戻る
        </button>
        <div className="topbar__meta">
          <strong>育成済みポケモン</strong>
        </div>
      </header>

      <section className="panel panel--soft">
        {savedEntries.length === 0 ? (
          <div className="empty-box">保存されたポケモンはまだありません。</div>
        ) : (
          <div className="trained-list">
            {savedEntries.map((entry) => {
              const moves = Array.from(
                { length: MOVE_SLOT_COUNT },
                (_, index) => entry.moves?.[index] ?? null,
              );

              return (
                <article key={entry.id} className="trained-card">
                  <div className="trained-card__header">
                    <h2>{getEntryDisplayName(entry)}</h2>
                    <div className="trained-card__header-actions">
                      <span>{new Date(entry.savedAt).toLocaleString("ja-JP")}</span>
                      <button
                        className="ghost-button trained-card__edit-button"
                        type="button"
                        onClick={() => handleEdit(entry)}
                      >
                        編集
                      </button>
                      <button
                        className="trained-card__delete-button"
                        type="button"
                        aria-label={`${getEntryDisplayName(entry)} を削除`}
                        onClick={() => handleDelete(entry)}
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </div>

                  <div className="trained-card__body">
                    <div className="trained-card__summary">
                      <div className="trained-card__meta">
                        <span>特性: {entry.abilityName || "—"}</span>
                        <span>持ち物: {entry.itemName || "—"}</span>
                        <span>性格: {entry.natureName || "—"}</span>
                      </div>

                      <div className="trained-card__memo">
                        <span className="trained-card__memo-label">メモ</span>
                        <p>{entry.memo || "—"}</p>
                      </div>

                      <div className="move-grid trained-card__move-grid">
                        {moves.map((move, index) => (
                          <SavedMoveCard key={`${entry.id}-move-${index}`} move={move} index={index} />
                        ))}
                      </div>
                    </div>

                    <div className="trained-card__chart-wrap">
                      <PokemonRadarChart entry={entry} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
