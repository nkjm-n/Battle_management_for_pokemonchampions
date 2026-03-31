import { useEffect, useState } from "react";
import { itemList, moveList, pokemonList } from "../lib/data";
import {
  buildActualStats,
  calculateDamageRange,
  getAttackStatKeyForMove,
  getDefenseStatKeyForMove,
} from "../lib/pokemonDamage";
import { getMoveTypeClassName } from "../lib/moveTypeClass";
import { natureMap, natures } from "../lib/natures";
import AutocompleteInput from "./AutocompleteInput";

const TOTAL_SP_LIMIT = 66;
const MAX_SP_PER_STAT = 32;
const DEAL_SP_KEYS = ["hp", "defense", "specialDefense"];
const TAKE_SP_KEYS = ["attack", "specialAttack"];
const DEFAULT_NATURE = "まじめ";
const FIELD_OPTIONS = ["なし", "エレキフィールド", "グラスフィールド", "サイコフィールド", "ミストフィールド"];
const STAGE_OPTIONS = Array.from({ length: 13 }, (_, index) => index - 6);

const STAT_LABELS = {
  hp: "HP",
  attack: "攻撃",
  defense: "防御",
  specialAttack: "特攻",
  specialDefense: "特防",
};

const STAT_SHORT_LABELS = {
  attack: "A",
  defense: "B",
  specialAttack: "C",
  specialDefense: "D",
  speed: "S",
};

function normalizeKana(value) {
  return value.replace(/[\u3041-\u3096]/g, (character) =>
    String.fromCodePoint(character.codePointAt(0) + 0x60),
  );
}

function normalizeSearchValue(value) {
  return normalizeKana(String(value ?? "").normalize("NFKC"))
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s\u3000]+/g, "");
}

function createSuggestions(records, query, toMeta) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return [];
  }

  return records
    .filter((record) => normalizeSearchValue(record.name).includes(normalizedQuery))
    .sort((left, right) => {
      const leftName = normalizeSearchValue(left.name);
      const rightName = normalizeSearchValue(right.name);
      const leftStarts = leftName.startsWith(normalizedQuery) ? 0 : 1;
      const rightStarts = rightName.startsWith(normalizedQuery) ? 0 : 1;

      if (leftStarts !== rightStarts) {
        return leftStarts - rightStarts;
      }

      return leftName.localeCompare(rightName, "ja");
    })
    .slice(0, 8)
    .map((record) => ({
      key: `${record.name}-${record.id ?? record.name}`,
      value: record.name,
      meta: toMeta?.(record) ?? "",
    }));
}

function findExactRecord(records, query) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return null;
  }

  return records.find((record) => normalizeSearchValue(record.name) === normalizedQuery) ?? null;
}

function createInitialSpValues(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function createSpInputState(values, keys) {
  return Object.fromEntries(keys.map((key) => [key, values[key] === 0 ? "" : String(values[key])]));
}

function sumSpValues(values, keys) {
  return keys.reduce((sum, key) => sum + (values[key] ?? 0), 0);
}

function getMaxAssignableSp(values, keys, statKey) {
  const spentWithoutCurrent = keys
    .filter((key) => key !== statKey)
    .reduce((sum, key) => sum + (values[key] ?? 0), 0);

  return Math.max(0, Math.min(MAX_SP_PER_STAT, TOTAL_SP_LIMIT - spentWithoutCurrent));
}

function normalizeSpValue(values, keys, statKey, nextValue) {
  const clampedValue = Math.max(0, Math.min(MAX_SP_PER_STAT, nextValue));
  return Math.min(clampedValue, getMaxAssignableSp(values, keys, statKey));
}

function buildPartialSpValues(keys, partialValues) {
  return {
    hp: partialValues.hp ?? 0,
    attack: partialValues.attack ?? 0,
    defense: partialValues.defense ?? 0,
    specialAttack: partialValues.specialAttack ?? 0,
    specialDefense: partialValues.specialDefense ?? 0,
    speed: 0,
    ...Object.fromEntries(keys.map((key) => [key, partialValues[key] ?? 0])),
  };
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function getNatureTone(natureName, statKey) {
  const nature = natureMap[natureName];
  if (!nature?.up || !nature?.down) {
    return "neutral";
  }

  if (nature.up === statKey) {
    return "up";
  }

  if (nature.down === statKey) {
    return "down";
  }

  return "neutral";
}

function formatNatureOptionLabel(nature) {
  if (!nature.up || !nature.down) {
    return `${nature.name} 補正なし`;
  }

  return `${nature.name} ${STAT_SHORT_LABELS[nature.up]}↑${STAT_SHORT_LABELS[nature.down]}↓`;
}

function formatStageOptionLabel(stage) {
  return stage > 0 ? `+${stage}` : String(stage);
}

function ReadOnlyModifierField({ label, value }) {
  return (
    <div className="damage-readonly-field">
      <span className="field__label">{label}</span>
      <strong>{value || "なし"}</strong>
    </div>
  );
}

function DamageResult({ result, sourceLabel }) {
  if (!result) {
    return <div className="damage-result damage-result--empty">必要な情報を入力するとダメージを表示します。</div>;
  }

  if (!result.isComputable) {
    return <div className="damage-result damage-result--empty">{result.message}</div>;
  }

  const attackLabel = STAT_LABELS[result.attackStatKey] ?? result.attackStatKey;
  const defenseLabel = STAT_LABELS[result.defenseStatKey] ?? result.defenseStatKey;

  return (
    <div className="damage-result">
      <div className="damage-result__headline">
        <strong>
          {formatPercent(result.minPercent)} - {formatPercent(result.maxPercent)}
        </strong>
        <span>
          {result.minDamage} - {result.maxDamage} ダメージ
        </span>
      </div>

      <div className={`damage-bar ${result.maxPercent >= 100 ? "damage-bar--ko" : ""}`}>
        <div className="damage-bar__max" style={{ width: `${result.maxBarPercent}%` }} />
        <div className="damage-bar__min" style={{ width: `${result.minBarPercent}%` }} />
      </div>

      <div className="damage-result__meta">
        <span>
          {sourceLabel}: {attackLabel} {result.attackValue}
        </span>
        <span>
          防御側: {defenseLabel} {result.defenseValue} / HP {result.defenderHp}
        </span>
        <span>
          タイプ一致 x{result.stabMultiplier.toFixed(1)} / 相性 x{result.typeEffectiveness.toFixed(2)}
        </span>
        {result.modifierNotes?.length > 0 ? <span>補正: {result.modifierNotes.join(" / ")}</span> : null}
      </div>
    </div>
  );
}

function NatureSelect({ value, onChange }) {
  const selectedNature = natureMap[value];

  return (
    <label className="field">
      <span className="field__label">性格</span>
      <select className="field__input field__select" value={value} onChange={(event) => onChange(event.target.value)}>
        {natures.map((nature) => (
          <option key={nature.name} value={nature.name}>
            {formatNatureOptionLabel(nature)}
          </option>
        ))}
      </select>
      {selectedNature?.up && selectedNature?.down ? (
        <span className="damage-nature-summary">
          <span className="damage-nature-summary__name">{selectedNature.name}</span>
          <span className="damage-nature-summary__up">{STAT_SHORT_LABELS[selectedNature.up]}↑</span>
          <span className="damage-nature-summary__down">{STAT_SHORT_LABELS[selectedNature.down]}↓</span>
        </span>
      ) : (
        <span className="damage-nature-summary">
          <span className="damage-nature-summary__name">{selectedNature?.name ?? DEFAULT_NATURE}</span>
          <span>補正なし</span>
        </span>
      )}
    </label>
  );
}

function StatSpInputs({ statKeys, values, inputs, onChange }) {
  return (
    <div className="damage-sp-grid">
      {statKeys.map((statKey) => (
        <label key={statKey} className="field damage-sp-grid__field">
          <span className="field__label">{STAT_LABELS[statKey]} SP</span>
          <input
            className="field__input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={inputs[statKey]}
            onChange={(event) => onChange(statKey, event.target.value)}
          />
          <small className="field__helper">{values[statKey]}</small>
        </label>
      ))}
    </div>
  );
}

function StatSummary({ stats, statKeys, natureName }) {
  return (
    <div className="damage-stat-summary">
      {statKeys.map((statKey) => {
        const tone = getNatureTone(natureName, statKey);

        return (
          <div key={statKey} className={`damage-stat-summary__tile damage-stat-summary__tile--${tone}`}>
            <span className={`damage-stat-summary__label damage-stat-summary__label--${tone}`}>
              {STAT_LABELS[statKey]}
            </span>
            <strong>{stats?.[statKey] ?? "—"}</strong>
          </div>
        );
      })}
    </div>
  );
}

export default function DamageCalculatorPanel({
  className = "",
  mode,
  title,
  sourcePokemon,
  sourceActualStats,
  sourceMoves = [],
  sourceAbilityName = "",
  sourceItemName = "",
}) {
  const isDealMode = mode === "deal";
  const spKeys = isDealMode ? DEAL_SP_KEYS : TAKE_SP_KEYS;
  const targetLabel = isDealMode ? "仮想敵" : "相手";
  const [pokemonQuery, setPokemonQuery] = useState("");
  const [natureName, setNatureName] = useState(DEFAULT_NATURE);
  const [moveQuery, setMoveQuery] = useState("");
  const [selectedSourceMoveName, setSelectedSourceMoveName] = useState("");
  const [targetAbilityName, setTargetAbilityName] = useState("");
  const [targetItemQuery, setTargetItemQuery] = useState("");
  const [attackerStage, setAttackerStage] = useState(0);
  const [defenderStage, setDefenderStage] = useState(0);
  const [fieldName, setFieldName] = useState("なし");
  const [isCritical, setIsCritical] = useState(false);
  const [isSpread, setIsSpread] = useState(false);
  const [attackerGrounded, setAttackerGrounded] = useState(true);
  const [defenderGrounded, setDefenderGrounded] = useState(true);
  const [spValues, setSpValues] = useState(() => createInitialSpValues(spKeys));
  const [spInputs, setSpInputs] = useState(() => createSpInputState(createInitialSpValues(spKeys), spKeys));

  const selectedPokemon = findExactRecord(pokemonList, pokemonQuery);
  const targetAbilityOptions = selectedPokemon?.abilityOptions ?? [];
  const targetItem = findExactRecord(itemList, targetItemQuery);
  const targetItemName = targetItem?.name ?? targetItemQuery.trim();
  const availableSourceMoves = sourceMoves.filter(Boolean);
  const selectedSourceMove =
    availableSourceMoves.find((move) => move.name === selectedSourceMoveName) ?? availableSourceMoves[0] ?? null;
  const selectedEnemyMove = findExactRecord(moveList, moveQuery);
  const currentMove = isDealMode ? selectedSourceMove : selectedEnemyMove;
  const configuredStats = buildActualStats(selectedPokemon, buildPartialSpValues(spKeys, spValues), natureName);
  const attackStageLabel = STAT_LABELS[getAttackStatKeyForMove(currentMove)] ?? "攻撃";
  const defenseStageLabel = STAT_LABELS[getDefenseStatKeyForMove(currentMove)] ?? "防御";

  const pokemonSuggestions = createSuggestions(
    pokemonList,
    pokemonQuery,
    (pokemon) => `${pokemon.types.join(" / ")} / HP ${pokemon.stats.hp}`,
  );
  const moveSuggestions = createSuggestions(
    moveList,
    moveQuery,
    (move) =>
      `${move.type} / ${move.moveKind}${move.attackClass ? ` / ${move.attackClass}` : ""}${move.power ? ` / 威力 ${move.power}` : ""}`,
  );
  const itemSuggestions = createSuggestions(itemList, targetItemQuery, (item) => item.pocket);

  useEffect(() => {
    if (!isDealMode) {
      return;
    }

    if (availableSourceMoves.some((move) => move.name === selectedSourceMoveName)) {
      return;
    }

    setSelectedSourceMoveName(availableSourceMoves[0]?.name ?? "");
  }, [availableSourceMoves, isDealMode, selectedSourceMoveName]);

  useEffect(() => {
    setTargetAbilityName((current) => {
      if (!selectedPokemon) {
        return "";
      }

      const nextAbility = selectedPokemon.abilityOptions.find((ability) => ability.name === current);
      return nextAbility?.name ?? selectedPokemon.abilityOptions[0]?.name ?? "";
    });
  }, [selectedPokemon]);

  const result = isDealMode
    ? calculateDamageRange({
        attackerPokemon: sourcePokemon,
        defenderPokemon: selectedPokemon,
        attackerStats: sourceActualStats,
        defenderStats: configuredStats,
        move: selectedSourceMove,
        attackerAbilityName: sourceAbilityName,
        defenderAbilityName: targetAbilityName,
        attackerItemName: sourceItemName,
        defenderItemName: targetItemName,
        attackerStage,
        defenderStage,
        fieldName,
        attackerGrounded,
        defenderGrounded,
        isCritical,
        isSpread,
      })
    : calculateDamageRange({
        attackerPokemon: selectedPokemon,
        defenderPokemon: sourcePokemon,
        attackerStats: configuredStats,
        defenderStats: sourceActualStats,
        move: selectedEnemyMove,
        attackerAbilityName: targetAbilityName,
        defenderAbilityName: sourceAbilityName,
        attackerItemName: targetItemName,
        defenderItemName: sourceItemName,
        attackerStage,
        defenderStage,
        fieldName,
        attackerGrounded,
        defenderGrounded,
        isCritical,
        isSpread,
      });

  function updateSpValue(statKey, rawValue) {
    const digitsOnly = rawValue.replace(/[^\d]/g, "");
    const parsedValue = Number.parseInt(digitsOnly, 10);

    setSpValues((current) => {
      const normalizedValue = normalizeSpValue(current, spKeys, statKey, Number.isFinite(parsedValue) ? parsedValue : 0);
      setSpInputs((currentInputs) => ({
        ...currentInputs,
        [statKey]: digitsOnly === "" ? "" : String(normalizedValue),
      }));

      return {
        ...current,
        [statKey]: normalizedValue,
      };
    });
  }

  const remainingSp = TOTAL_SP_LIMIT - sumSpValues(spValues, spKeys);
  const sourceAttackStatKey = isDealMode ? getAttackStatKeyForMove(selectedSourceMove) : getDefenseStatKeyForMove(selectedEnemyMove);
  const sourceLabel = isDealMode ? "こちら" : "相手";

  return (
    <section className={`panel panel--strong damage-panel ${className}`.trim()}>
      <div className="damage-panel__header">
        <h3>{title}</h3>
        <span>Lv.50</span>
      </div>

      {isDealMode ? (
        <div className="damage-panel__move-grid">
          {availableSourceMoves.length > 0 ? (
            availableSourceMoves.map((move) => (
              <button
                key={move.name}
                type="button"
                className={`move-card damage-move-button ${getMoveTypeClassName(move.type)} ${
                  selectedSourceMove?.name === move.name ? "damage-move-button--selected" : ""
                }`.trim()}
                onClick={() => setSelectedSourceMoveName(move.name)}
              >
                <strong className="damage-move-button__name">{move.name}</strong>
                <span className="damage-move-button__meta">
                  {move.type} / {move.attackClass || move.moveKind} {move.power ? `/ ${move.power}` : ""}
                </span>
              </button>
            ))
          ) : (
            <div className="damage-result damage-result--empty">上部で技を登録すると与ダメージ計算に使えます。</div>
          )}
        </div>
      ) : (
        <AutocompleteInput
          label="相手の技"
          value={moveQuery}
          placeholder="例: じしん"
          suggestions={moveSuggestions}
          onChange={setMoveQuery}
          onSelect={setMoveQuery}
        />
      )}

      <div className="damage-panel__config-grid">
        <AutocompleteInput
          label={isDealMode ? "仮想敵" : "相手ポケモン"}
          value={pokemonQuery}
          placeholder={isDealMode ? "例: サーフゴー" : "例: ガブリアス"}
          suggestions={pokemonSuggestions}
          onChange={setPokemonQuery}
          onSelect={setPokemonQuery}
        />

        <NatureSelect value={natureName} onChange={setNatureName} />
      </div>

      <div className="damage-side-grid">
        <ReadOnlyModifierField label="こちらの特性" value={sourceAbilityName} />
        <ReadOnlyModifierField label="こちらの持ち物" value={sourceItemName} />

        <label className="field">
          <span className="field__label">{targetLabel}の特性</span>
          <select
            className="field__input field__select"
            value={targetAbilityName}
            onChange={(event) => setTargetAbilityName(event.target.value)}
            disabled={!selectedPokemon}
          >
            {selectedPokemon ? (
              targetAbilityOptions.map((ability) => (
                <option key={ability.name} value={ability.name}>
                  {ability.name}
                  {ability.isHidden ? " (夢)" : ""}
                </option>
              ))
            ) : (
              <option value="">ポケモン選択後</option>
            )}
          </select>
          {targetAbilityName ? (
            <small className="field__helper">
              {targetAbilityOptions.find((ability) => ability.name === targetAbilityName)?.effect ?? ""}
            </small>
          ) : null}
        </label>

        <AutocompleteInput
          label={`${targetLabel}の持ち物`}
          value={targetItemQuery}
          placeholder="例: オボンのみ"
          suggestions={itemSuggestions}
          onChange={setTargetItemQuery}
          onSelect={setTargetItemQuery}
        />
      </div>

      <StatSpInputs statKeys={spKeys} values={spValues} inputs={spInputs} onChange={updateSpValue} />

      <div className="damage-adjustment-grid">
        <label className="field">
          <span className="field__label">攻撃側 {attackStageLabel}ランク</span>
          <select
            className="field__input field__select"
            value={attackerStage}
            onChange={(event) => setAttackerStage(Number(event.target.value))}
          >
            {STAGE_OPTIONS.map((stage) => (
              <option key={`attacker-stage-${stage}`} value={stage}>
                {formatStageOptionLabel(stage)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">防御側 {defenseStageLabel}ランク</span>
          <select
            className="field__input field__select"
            value={defenderStage}
            onChange={(event) => setDefenderStage(Number(event.target.value))}
          >
            {STAGE_OPTIONS.map((stage) => (
              <option key={`defender-stage-${stage}`} value={stage}>
                {formatStageOptionLabel(stage)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">フィールド</span>
          <select
            className="field__input field__select"
            value={fieldName}
            onChange={(event) => setFieldName(event.target.value)}
          >
            {FIELD_OPTIONS.map((fieldOption) => (
              <option key={fieldOption} value={fieldOption}>
                {fieldOption}
              </option>
            ))}
          </select>
        </label>

        <label className="damage-toggle">
          <input type="checkbox" checked={isCritical} onChange={(event) => setIsCritical(event.target.checked)} />
          <span>急所</span>
        </label>

        <label className="damage-toggle">
          <input type="checkbox" checked={isSpread} onChange={(event) => setIsSpread(event.target.checked)} />
          <span>複数対象</span>
        </label>

        <label className="damage-toggle">
          <input
            type="checkbox"
            checked={attackerGrounded}
            onChange={(event) => setAttackerGrounded(event.target.checked)}
          />
          <span>攻撃側は接地</span>
        </label>

        <label className="damage-toggle">
          <input
            type="checkbox"
            checked={defenderGrounded}
            onChange={(event) => setDefenderGrounded(event.target.checked)}
          />
          <span>防御側は接地</span>
        </label>
      </div>

      <div className="damage-panel__footer">
        <span className="damage-panel__remaining-sp">残りSP {remainingSp}</span>
        <StatSummary stats={configuredStats} statKeys={spKeys} natureName={natureName} />
      </div>

      {sourcePokemon && sourceActualStats && selectedPokemon ? (
        <DamageResult result={result} sourceLabel={sourceLabel} />
      ) : (
        <div className="damage-result damage-result--empty">
          {sourcePokemon ? "相手ポケモンを設定するとダメージを表示します。" : "上部でポケモンを設定すると計算を開始できます。"}
        </div>
      )}

      {sourceAttackStatKey ? (
        <p className="damage-panel__caption">
          {isDealMode ? "こちらの参照実数値" : "こちらの参照防御実数値"}: {STAT_LABELS[sourceAttackStatKey]} {sourceActualStats?.[sourceAttackStatKey] ?? "—"}
        </p>
      ) : null}
    </section>
  );
}
