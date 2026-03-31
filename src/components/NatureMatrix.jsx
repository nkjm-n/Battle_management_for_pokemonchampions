import { natureMap, natureMatrix, neutralNatureNames, statsOrder } from "../lib/natures";

function renderMultiplierText(natureName) {
  const nature = natureMap[natureName];
  if (!nature || !nature.up || !nature.down) {
    return "x1.0";
  }

  return "x1.1 / x0.9";
}

export default function NatureMatrix({ selectedNature, onSelectNature, showHeader = true }) {
  const selectedNatureInfo = natureMap[selectedNature];

  return (
    <section className="panel panel--soft nature-matrix">
      {showHeader ? (
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Nature</p>
            <h2>性格補正表</h2>
          </div>
          <div className="nature-summary">
            <span className="nature-summary__label">現在の性格</span>
            <strong>{selectedNature}</strong>
            <span className="nature-summary__detail">
              {selectedNatureInfo?.up && selectedNatureInfo?.down
                ? `上昇: ${
                    statsOrder.find((stat) => stat.key === selectedNatureInfo.up)?.label
                  } / 下降: ${statsOrder.find((stat) => stat.key === selectedNatureInfo.down)?.label}`
                : "無補正"}
            </span>
          </div>
        </div>
      ) : (
        <div className="nature-summary nature-summary--standalone">
          <span className="nature-summary__label">現在の性格</span>
          <strong>{selectedNature}</strong>
          <span className="nature-summary__detail">
            {selectedNatureInfo?.up && selectedNatureInfo?.down
              ? `上昇: ${
                  statsOrder.find((stat) => stat.key === selectedNatureInfo.up)?.label
                } / 下降: ${statsOrder.find((stat) => stat.key === selectedNatureInfo.down)?.label}`
              : "無補正"}
          </span>
        </div>
      )}

      <div className="nature-table-wrap">
        <table className="nature-table">
          <thead>
            <tr>
              <th className="nature-table__corner" aria-hidden="true" />
              {statsOrder.map((stat) => (
                <th key={stat.key} className="nature-table__axis nature-table__axis--horizontal">
                  ↑ {stat.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statsOrder.map((downStat) => (
              <tr key={downStat.key}>
                <th className="nature-table__axis nature-table__axis--vertical">↓ {downStat.label}</th>
                {statsOrder.map((upStat) => {
                  const nature = natureMatrix[downStat.key][upStat.key];
                  const isSelected = selectedNature === nature?.name;

                  if (!nature) {
                    return (
                      <td key={upStat.key} className="nature-table__neutral">
                        <span>無補正</span>
                        <small>x1.0</small>
                      </td>
                    );
                  }

                  return (
                    <td key={upStat.key}>
                      <button
                        className={`nature-cell ${isSelected ? "nature-cell--selected" : ""}`}
                        type="button"
                        onClick={() => onSelectNature(nature.name)}
                      >
                        <strong>{nature.name}</strong>
                        <small>{renderMultiplierText(nature.name)}</small>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="neutral-natures">
        <span className="neutral-natures__label">無補正の性格</span>
        <div className="neutral-natures__list">
          {neutralNatureNames.map((natureName) => (
            <button
              key={natureName}
              className={`neutral-nature-chip ${selectedNature === natureName ? "neutral-nature-chip--selected" : ""}`}
              type="button"
              onClick={() => onSelectNature(natureName)}
            >
              {natureName}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
