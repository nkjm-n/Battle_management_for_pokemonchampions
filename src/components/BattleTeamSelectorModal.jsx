export default function BattleTeamSelectorModal({
  isOpen,
  teamOptions,
  newTeamName,
  notice,
  onClose,
  onToggleTeam,
  onNewTeamNameChange,
  onCreateTeam,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-window modal-window--team-selector"
        role="dialog"
        aria-modal="true"
        aria-label="バトルチーム選択"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-window__header">
          <div>
            <p className="section-heading__eyebrow">Battle Team</p>
            <h2>バトルチーム選択</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="team-selector-modal">
          <div className="team-selector-modal__list">
            {teamOptions.length === 0 ? (
              <div className="team-selector-modal__empty">登録済みチームはまだありません。</div>
            ) : (
              teamOptions.map((team) => (
                <label
                  key={team.id}
                  className={`team-selector-option ${
                    team.isDisabled ? "team-selector-option--disabled" : ""
                  } ${team.isSelected ? "team-selector-option--selected" : ""}`.trim()}
                >
                  <input
                    type="checkbox"
                    checked={team.isSelected}
                    disabled={team.isDisabled}
                    onChange={() => onToggleTeam(team.id)}
                  />
                  <div className="team-selector-option__body">
                    <strong>{team.name}</strong>
                    <span>{team.statusLabel}</span>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="team-selector-modal__footer">
            <label className="field">
              <span className="field__label">新規チーム名</span>
              <input
                className="field__input"
                type="text"
                value={newTeamName}
                placeholder="例: シーズン1"
                onChange={(event) => onNewTeamNameChange(event.target.value)}
              />
            </label>
            <button className="ghost-button" type="button" onClick={onCreateTeam}>
              チーム追加
            </button>
          </div>

          {notice ? (
            <p className={`team-selection-note ${notice.tone === "error" ? "team-selection-note--error" : ""}`}>
              {notice.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
