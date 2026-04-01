import { useState } from "react";
import { MAX_BATTLE_TEAM_SIZE } from "../lib/battleTeams";
import { getPokemonRecordByName } from "../lib/data";
import { getEntryDisplayName, getEntryTypeText } from "../lib/pokemonEntryDisplay";
import { buildActualStats } from "../lib/pokemonDamage";

const DRAG_TYPE = "application/x-battle-team-pokemon";
const SWAP_STAT_ROWS = [
  { key: "hp", label: "HP" },
  { key: "attack", label: "攻撃" },
  { key: "defense", label: "防御" },
  { key: "specialAttack", label: "特攻" },
  { key: "specialDefense", label: "特防" },
  { key: "speed", label: "すばやさ" },
];

function buildTeamSlots(pokemonIds) {
  return Array.from({ length: MAX_BATTLE_TEAM_SIZE }, (_, index) => pokemonIds[index] ?? null);
}

function movePokemonToSlot(currentPokemonIds, entryId, slotIndex, sourceIndex) {
  const slots = buildTeamSlots(currentPokemonIds);
  const originIndex =
    typeof sourceIndex === "number" && slots[sourceIndex] === entryId
      ? sourceIndex
      : slots.findIndex((pokemonId) => pokemonId === entryId);
  const nextSlots = slots.map((pokemonId) => (pokemonId === entryId ? null : pokemonId));
  const displacedPokemonId = nextSlots[slotIndex] ?? null;

  nextSlots[slotIndex] = entryId;

  if (originIndex !== -1 && originIndex !== slotIndex && displacedPokemonId && nextSlots[originIndex] == null) {
    nextSlots[originIndex] = displacedPokemonId;
  }

  return nextSlots.filter(Boolean);
}

function getResolvedActualStats(entry) {
  if (
    entry?.actualStats &&
    SWAP_STAT_ROWS.every(({ key }) => Number.isFinite(entry.actualStats[key]))
  ) {
    return entry.actualStats;
  }

  const pokemon = getPokemonRecordByName(entry?.pokemonName);
  return buildActualStats(pokemon, entry?.spValues ?? {}, entry?.natureName ?? "まじめ");
}

function TeamSwapCard({ entry, draggable = false, onDragStart, onDragEnd, isDragging = false }) {
  if (!entry) {
    return null;
  }

  const actualStats = getResolvedActualStats(entry);

  return (
    <article
      className={`battle-team-swap-card${isDragging ? " battle-team-swap-card--dragging" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <strong className="battle-team-swap-card__name">{getEntryDisplayName(entry)}</strong>
      <span className="battle-team-swap-card__meta">タイプ: {getEntryTypeText(entry)}</span>
      <span className="battle-team-swap-card__meta">持ち物: {entry.itemName || "—"}</span>
      <span className="battle-team-swap-card__meta">性格: {entry.natureName || "—"}</span>
      <div className="battle-team-swap-card__stats">
        {SWAP_STAT_ROWS.map(({ key, label }) => (
          <span key={key} className="battle-team-swap-card__stat-line">
            {label}:{actualStats?.[key] ?? "—"}({entry?.spValues?.[key] ?? 0})
          </span>
        ))}
      </div>
    </article>
  );
}

export default function BattleTeamReorderView({
  team,
  savedPokemon,
  onBack,
  onCreatePokemon,
  onReorderTeam,
}) {
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const validEntryById = new Map(savedPokemon.map((entry) => [entry.id, entry]));
  const currentPokemonIds = Array.isArray(team?.pokemonIds)
    ? team.pokemonIds.filter(
        (pokemonId, index, pokemonIds) =>
          typeof pokemonId === "string" &&
          validEntryById.has(pokemonId) &&
          pokemonIds.indexOf(pokemonId) === index,
      )
    : [];
  const teamSlots = buildTeamSlots(currentPokemonIds).map((pokemonId) =>
    pokemonId ? validEntryById.get(pokemonId) ?? null : null,
  );
  const currentPokemonIdSet = new Set(currentPokemonIds);
  const reserveEntries = savedPokemon
    .filter((entry) => !currentPokemonIdSet.has(entry.id))
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());

  function clearDragState() {
    setDragging(null);
    setDropTarget(null);
  }

  function readDragPayload(event) {
    if (dragging?.entryId) {
      return dragging;
    }

    try {
      const rawValue = event.dataTransfer.getData(DRAG_TYPE);
      return rawValue ? JSON.parse(rawValue) : null;
    } catch {
      return null;
    }
  }

  function createDragStartHandler(entryId, source, sourceIndex = null) {
    return (event) => {
      const payload = { entryId, source, sourceIndex };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
      setDragging(payload);
    };
  }

  function handleDropToSlot(slotIndex, event) {
    event.preventDefault();

    if (!team) {
      clearDragState();
      return;
    }

    const payload = readDragPayload(event);
    if (!payload?.entryId || !validEntryById.has(payload.entryId)) {
      clearDragState();
      return;
    }

    const nextPokemonIds = movePokemonToSlot(
      currentPokemonIds,
      payload.entryId,
      slotIndex,
      payload.source === "team" ? payload.sourceIndex : null,
    );

    onReorderTeam?.(team.id, nextPokemonIds);
    clearDragState();
  }

  function handleDropToReserve(event) {
    event.preventDefault();

    if (!team) {
      clearDragState();
      return;
    }

    const payload = readDragPayload(event);
    if (payload?.source !== "team" || !payload.entryId) {
      clearDragState();
      return;
    }

    onReorderTeam?.(
      team.id,
      currentPokemonIds.filter((pokemonId) => pokemonId !== payload.entryId),
    );
    clearDragState();
  }

  return (
    <div className="view-shell">
      <header className="topbar">
        <button className="ghost-button" type="button" onClick={onBack}>
          チーム詳細へ戻る
        </button>
        <div className="topbar__meta">
          <strong>{team?.name ?? "ポケモン入れ替え"}</strong>
          {team ? <span>{currentPokemonIds.length} / {MAX_BATTLE_TEAM_SIZE}</span> : null}
        </div>
      </header>

      <section className="panel panel--soft battle-team-swap">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Swap</p>
            <h2>ポケモン入れ替え</h2>
          </div>
        </div>

        {team ? (
          <div className="battle-team-swap__slots">
            {teamSlots.map((entry, index) => {
              const isDropTarget = dropTarget?.kind === "slot" && dropTarget.index === index;

              return (
                <div
                  key={`${team.id}-swap-slot-${index}`}
                  className={`battle-team-swap-slot${isDropTarget ? " battle-team-swap-slot--target" : ""}`}
                  onDragEnter={() => setDropTarget({ kind: "slot", index })}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTarget({ kind: "slot", index });
                  }}
                  onDrop={(event) => handleDropToSlot(index, event)}
                >
                  <span className="battle-team-swap-slot__label">#{index + 1}</span>
                  {entry ? (
                    <TeamSwapCard
                      entry={entry}
                      draggable
                      isDragging={dragging?.entryId === entry.id}
                      onDragStart={createDragStartHandler(entry.id, "team", index)}
                      onDragEnd={clearDragState}
                    />
                  ) : (
                    <div className="battle-team-swap-slot__empty">空き枠</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-box">選択されたバトルチームが見つかりませんでした。</div>
        )}
      </section>

      <section
        className={`panel panel--soft battle-team-swap-reserve${
          dropTarget?.kind === "reserve" ? " battle-team-swap-reserve--target" : ""
        }`}
        onDragEnter={() => {
          if (dragging?.source === "team") {
            setDropTarget({ kind: "reserve" });
          }
        }}
        onDragOver={(event) => {
          if (dragging?.source !== "team") {
            return;
          }

          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropTarget({ kind: "reserve" });
        }}
        onDrop={handleDropToReserve}
      >
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Reserve</p>
            <h2>育成済みポケモン</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onCreatePokemon}>
            新規作成
          </button>
        </div>

        <div className="battle-team-swap-reserve__hint">
          チームのカードをここへドロップすると、このパーティから外せます。
        </div>

        {reserveEntries.length > 0 ? (
          <div className="battle-team-swap-reserve__grid">
            {reserveEntries.map((entry) => (
              <TeamSwapCard
                key={entry.id}
                entry={entry}
                draggable
                isDragging={dragging?.entryId === entry.id}
                onDragStart={createDragStartHandler(entry.id, "reserve")}
                onDragEnd={clearDragState}
              />
            ))}
          </div>
        ) : (
          <div className="empty-box">このパーティ以外の育成済みポケモンはありません。</div>
        )}
      </section>
    </div>
  );
}
