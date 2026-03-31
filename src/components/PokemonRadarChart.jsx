const statConfig = [
  { key: "hp", label: "HP" },
  { key: "attack", label: "攻撃" },
  { key: "defense", label: "防御" },
  { key: "specialAttack", label: "特攻" },
  { key: "specialDefense", label: "特防" },
  { key: "speed", label: "すばやさ" },
];

const RADAR_SIZE = 260;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 72;
const RADAR_LABEL_RADIUS = 96;
const RADAR_LEVELS = [0.25, 0.5, 0.75, 1];
const RADAR_MAX_SP = 32;

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

export default function PokemonRadarChart({ entry, className = "trained-card__chart" }) {
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
    <div className={className}>
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
