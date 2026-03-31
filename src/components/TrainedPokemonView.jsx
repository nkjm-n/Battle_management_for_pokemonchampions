import { getMoveTypeClassName } from "../lib/moveTypeClass";

const statConfig = [
  { key: "hp", label: "HP" },
  { key: "attack", label: "攻撃" },
  { key: "defense", label: "防御" },
  { key: "specialAttack", label: "特攻" },
  { key: "specialDefense", label: "特防" },
  { key: "speed", label: "すばやさ" },
];

const MOVE_SLOT_COUNT = 4;
const RADAR_SIZE = 260;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 72;
const RADAR_LABEL_RADIUS = 96;
const RADAR_LEVELS = [0.25, 0.5, 0.75, 1];
const RADAR_MAX_SP = 32;

function getEntryDisplayName(entry) {
  const nickname = entry.nickname?.trim();
  return nickname ? `${entry.pokemonName}【${nickname}】` : entry.pokemonName;
}

function toSafeNumber(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getStatEntries(entry) {
  return statConfig.map((stat) => ({
    ...stat,
    actualValue: toSafeNumber(entry.actualStats?.[stat.key]),
    spValue: toSafeNumber(entry.spValues?.[stat.key]),
  }));
}

function getTextAnchor(angle) {
  const cosine = Math.cos(angle);
  if (cosine > 0.28) {
    return "start";
  }

  if (cosine < -0.28) {
    return "end";
  }

  return "middle";
}

function TrainedPokemonRadarChart({ entry }) {
  const stats = getStatEntries(entry);
  const axisPoints = stats.map((stat, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / stats.length;
    const axisX = RADAR_CENTER + Math.cos(angle) * RADAR_RADIUS;
    const axisY = RADAR_CENTER + Math.sin(angle) * RADAR_RADIUS;
    const ratio = Math.min(stat.spValue / RADAR_MAX_SP, 1);
    const pointX = RADAR_CENTER + Math.cos(angle) * RADAR_RADIUS * ratio;
    const pointY = RADAR_CENTER + Math.sin(angle) * RADAR_RADIUS * ratio;
    const labelX = RADAR_CENTER + Math.cos(angle) * RADAR_LABEL_RADIUS;
    const labelY = RADAR_CENTER + Math.sin(angle) * RADAR_LABEL_RADIUS - 4;

    return {
      ...stat,
      angle,
      axisX,
      axisY,
      pointX,
      pointY,
      labelX,
      labelY,
    };
  });

  const shapePoints = axisPoints.map((point) => `${point.pointX},${point.pointY}`).join(" ");

  return (
    <div className="trained-card__chart">
      <svg
        className="radar-chart"
        viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
        role="img"
        aria-label="SP配分レーダーチャート"
      >
        <g className="radar-chart__grid">
          {RADAR_LEVELS.map((level) => {
            const levelPoints = axisPoints
              .map((point) => {
                const x = RADAR_CENTER + Math.cos(point.angle) * RADAR_RADIUS * level;
                const y = RADAR_CENTER + Math.sin(point.angle) * RADAR_RADIUS * level;
                return `${x},${y}`;
              })
              .join(" ");

            return <polygon key={`grid-${level}`} points={levelPoints} />;
          })}
        </g>

        <g className="radar-chart__axes">
          {axisPoints.map((point) => (
            <line
              key={`axis-${point.key}`}
              x1={RADAR_CENTER}
              y1={RADAR_CENTER}
              x2={point.axisX}
              y2={point.axisY}
            />
          ))}
        </g>

        <polygon className="radar-chart__shape" points={shapePoints} />

        <g className="radar-chart__points">
          {axisPoints.map((point) => (
            <circle key={`point-${point.key}`} cx={point.pointX} cy={point.pointY} r="4.5" />
          ))}
        </g>

        <g className="radar-chart__labels">
          {axisPoints.map((point) => (
            <text
              key={`label-${point.key}`}
              x={point.labelX}
              y={point.labelY}
              textAnchor={getTextAnchor(point.angle)}
            >
              <tspan x={point.labelX}>{point.label}</tspan>
              <tspan x={point.labelX} dy="1.08em">
                {point.actualValue}({point.spValue})
              </tspan>
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

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
                      <TrainedPokemonRadarChart entry={entry} />
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
