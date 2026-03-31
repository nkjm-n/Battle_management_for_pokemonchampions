import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import {
  MAX_BATTLE_TEAM_SIZE,
  findAssignedBattleTeamIds,
  normalizeBattleTeamName,
} from "../lib/battleTeams";
import { itemList, moveList, pokemonList } from "../lib/data";
import { getMegaStoneItemName } from "../lib/megaStones";
import { getMoveTypeClassName } from "../lib/moveTypeClass";
import { getNatureMultiplier, natureMap, natures, statsOrder } from "../lib/natures";
import AutocompleteInput from "./AutocompleteInput";
import BattleTeamSelectorModal from "./BattleTeamSelectorModal";
import DamageCalculatorPanel from "./DamageCalculatorPanel";
import NatureMatrix from "./NatureMatrix";

const statCards = [
  { key: "hp", label: "HP" },
  { key: "attack", label: "攻撃" },
  { key: "defense", label: "防御" },
  { key: "specialAttack", label: "特攻" },
  { key: "specialDefense", label: "特防" },
  { key: "speed", label: "すば\nやさ" },
];

const TOTAL_SP_LIMIT = 66;
const MAX_SP_PER_STAT = 32;
const SP_SEGMENT_COUNT = 32;
const DEFENSIVE_AUTO_KEYS = ["hp", "defense", "specialDefense"];
const MOVE_SLOT_COUNT = 4;

const defaultSpValues = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};

const defaultSpInputValues = {
  hp: "",
  attack: "",
  defense: "",
  specialAttack: "",
  specialDefense: "",
  speed: "",
};

const defaultMoveQueries = Array.from({ length: MOVE_SLOT_COUNT }, () => "");
const defaultSelectedMoves = Array.from({ length: MOVE_SLOT_COUNT }, () => null);

function normalizeKana(value) {
  return value.replace(/[\u3041-\u3096]/g, (character) =>
    String.fromCodePoint(character.codePointAt(0) + 0x60),
  );
}

function normalizeSearchValue(value) {
  return normalizeKana(value.normalize("NFKC"))
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

function getNatureSummary(natureName) {
  const nature = natureMap[natureName];
  if (!nature || !nature.up || !nature.down) {
    return "無補正";
  }

  const upLabel = statsOrder.find((stat) => stat.key === nature.up)?.label;
  const downLabel = statsOrder.find((stat) => stat.key === nature.down)?.label;
  return `${upLabel}↑ / ${downLabel}↓`;
}

function getStatTone(natureName, statKey) {
  if (statKey === "hp") {
    return "neutral";
  }

  const nature = natureMap[natureName];
  if (!nature || !nature.up || !nature.down) {
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

function createSpInputState(values) {
  return Object.fromEntries(
    Object.entries(values).map(([statKey, value]) => [statKey, value === 0 ? "" : String(value)]),
  );
}

function getEntrySpValues(entry) {
  if (!entry?.spValues) {
    return { ...defaultSpValues };
  }

  return Object.fromEntries(
    Object.keys(defaultSpValues).map((statKey) => {
      const numericValue = Number(entry.spValues?.[statKey]);
      return [statKey, Number.isFinite(numericValue) ? numericValue : 0];
    }),
  );
}

function getEntryMoveQueries(entry) {
  return Array.from({ length: MOVE_SLOT_COUNT }, (_, index) => entry?.moves?.[index]?.name ?? "");
}

function getDefensiveNatureCandidates(pokemon) {
  if (!pokemon) {
    return [];
  }

  const attackBase = pokemon.stats.attack;
  const specialAttackBase = pokemon.stats.specialAttack;

  if (attackBase === specialAttackBase) {
    return natures.filter((nature) => nature.down === "attack" || nature.down === "specialAttack");
  }

  const preferredDownStatKey = attackBase < specialAttackBase ? "attack" : "specialAttack";
  return natures.filter((nature) => nature.down === preferredDownStatKey);
}

function createDraftBattleTeamId() {
  return `draft-team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function TrainingStartView({
  battleTeams = [],
  initialEntry = null,
  backLabel = "ホームへ戻る",
  onBack,
  onSave,
}) {
  const [pokemonQuery, setPokemonQuery] = useState(initialEntry?.pokemonName ?? "");
  const [nickname, setNickname] = useState(initialEntry?.nickname ?? "");
  const [memo, setMemo] = useState(initialEntry?.memo ?? "");
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [selectedAbility, setSelectedAbility] = useState(initialEntry?.abilityName ?? "");
  const [itemQuery, setItemQuery] = useState(initialEntry?.itemName ?? "");
  const [selectedItem, setSelectedItem] = useState(null);
  const [moveQueries, setMoveQueries] = useState(() => getEntryMoveQueries(initialEntry));
  const [selectedMoves, setSelectedMoves] = useState(defaultSelectedMoves);
  const [selectedNature, setSelectedNature] = useState(initialEntry?.natureName ?? "まじめ");
  const [selectedBattleTeamIds, setSelectedBattleTeamIds] = useState(
    () => findAssignedBattleTeamIds(battleTeams, initialEntry),
  );
  const [draftBattleTeams, setDraftBattleTeams] = useState([]);
  const [newBattleTeamName, setNewBattleTeamName] = useState("");
  const [isNatureTableOpen, setIsNatureTableOpen] = useState(false);
  const [isBattleTeamModalOpen, setIsBattleTeamModalOpen] = useState(false);
  const [draggingSpStatKey, setDraggingSpStatKey] = useState(null);
  const [autoAdjustNotice, setAutoAdjustNotice] = useState("");
  const [battleTeamNotice, setBattleTeamNotice] = useState(null);
  const [saveNotice, setSaveNotice] = useState(null);
  const [spValues, setSpValues] = useState(() => getEntrySpValues(initialEntry));
  const [spInputValues, setSpInputValues] = useState(() =>
    createSpInputState(getEntrySpValues(initialEntry)),
  );
  const previousLockedItemNameRef = useRef("");

  const deferredPokemonQuery = useDeferredValue(pokemonQuery);
  const deferredItemQuery = useDeferredValue(itemQuery);
  const deferredMoveQueries = useDeferredValue(moveQueries);
  const megaStoneItemName = getMegaStoneItemName(selectedPokemon?.name);
  const isMegaStoneLocked = Boolean(megaStoneItemName);

  const pokemonSuggestions = createSuggestions(
    pokemonList,
    deferredPokemonQuery,
    (pokemon) => {
      const normalAbilityNames = pokemon.abilities.map((ability) => ability.name).join(" / ");
      const hiddenAbilityName = pokemon.hiddenAbility?.name ? `夢: ${pokemon.hiddenAbility.name}` : "夢特性なし";
      return `${normalAbilityNames} / ${hiddenAbilityName}`;
    },
  );

  const itemSuggestions = createSuggestions(itemList, deferredItemQuery, (item) => item.pocket);
  const moveSuggestions = deferredMoveQueries.map((query) =>
    createSuggestions(moveList, query, (move) => {
      const attackSummary =
        move.moveKind === "攻撃技" ? ` / ${move.attackClass} / 威力 ${move.power ?? "—"}` : "";
      return `${move.type} / ${move.moveKind}${attackSummary} / PP ${move.pp}`;
    }),
  );

  useEffect(() => {
    const pokemon = findExactRecord(pokemonList, pokemonQuery);
    setSelectedPokemon(pokemon);
    setSelectedAbility((current) => {
      if (!pokemon) {
        return "";
      }

      const nextAbility = pokemon.abilityOptions.find((ability) => ability.name === current);
      return nextAbility?.name ?? pokemon.abilityOptions[0]?.name ?? "";
    });
  }, [pokemonQuery]);

  useEffect(() => {
    setSelectedItem(findExactRecord(itemList, itemQuery));
  }, [itemQuery]);

  useEffect(() => {
    const previousLockedItemName = previousLockedItemNameRef.current;

    setItemQuery((current) => {
      if (megaStoneItemName) {
        return current === megaStoneItemName ? current : megaStoneItemName;
      }

      if (previousLockedItemName && current === previousLockedItemName) {
        return "";
      }

      return current;
    });

    previousLockedItemNameRef.current = megaStoneItemName;
  }, [megaStoneItemName]);

  useEffect(() => {
    setSelectedMoves(moveQueries.map((query) => findExactRecord(moveList, query)));
  }, [moveQueries]);

  useEffect(() => {
    if (!isNatureTableOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsNatureTableOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNatureTableOpen]);

  useEffect(() => {
    if (!isBattleTeamModalOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsBattleTeamModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBattleTeamModalOpen]);

  useEffect(() => {
    if (!draggingSpStatKey) {
      return undefined;
    }

    function stopSpDrag() {
      setDraggingSpStatKey(null);
    }

    window.addEventListener("pointerup", stopSpDrag);
    window.addEventListener("pointercancel", stopSpDrag);

    return () => {
      window.removeEventListener("pointerup", stopSpDrag);
      window.removeEventListener("pointercancel", stopSpDrag);
    };
  }, [draggingSpStatKey]);

  useEffect(() => {
    if (!saveNotice) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setSaveNotice(null);
    }, 2000);

    return () => window.clearTimeout(timerId);
  }, [saveNotice]);

  const totalSp = Object.values(spValues).reduce((sum, value) => sum + value, 0);
  const remainingSp = TOTAL_SP_LIMIT - totalSp;
  const itemEffectMessage =
    selectedItem?.effect ?? (isMegaStoneLocked ? "メガシンカ用の固定持ち物です。" : "");
  const isEditing = Boolean(initialEntry);
  const saveButtonLabel = isEditing ? "上書き保存" : "保存";
  const saveNoticeLabel = isEditing ? "上書き保存しました" : "保存されました";
  const normalizedNewBattleTeamName = normalizeBattleTeamName(newBattleTeamName);
  const draftBattleTeamIdSet = new Set(draftBattleTeams.map((team) => team.id));
  const currentBattleTeamIds = findAssignedBattleTeamIds(battleTeams, initialEntry);
  const battleTeamOptions = [
    ...battleTeams,
    ...draftBattleTeams.map((team) => ({
      ...team,
      pokemonIds: [],
    })),
  ].map((team) => {
    const isDraft = draftBattleTeamIdSet.has(team.id);
    const isCurrentMember = currentBattleTeamIds.includes(team.id);
    const isSelected = selectedBattleTeamIds.includes(team.id);
    const isFull = !isDraft && team.pokemonIds.length >= MAX_BATTLE_TEAM_SIZE && !isCurrentMember;

    return {
      ...team,
      isDraft,
      isSelected,
      isDisabled: isFull,
      statusLabel: isFull
        ? "満員"
        : isDraft
          ? `新規チーム / 0/${MAX_BATTLE_TEAM_SIZE}`
          : `${team.pokemonIds.length}/${MAX_BATTLE_TEAM_SIZE}`,
    };
  });
  const selectedBattleTeamNames = battleTeamOptions
    .filter((team) => selectedBattleTeamIds.includes(team.id))
    .map((team) => team.name);
  const canSave = Boolean(selectedPokemon);

  useEffect(() => {
    const availableBattleTeamIds = new Set(battleTeamOptions.map((team) => team.id));

    setSelectedBattleTeamIds((current) => {
      const nextBattleTeamIds = current.filter((teamId) => availableBattleTeamIds.has(teamId));
      const hasChanged =
        nextBattleTeamIds.length !== current.length ||
        nextBattleTeamIds.some((teamId, index) => teamId !== current[index]);

      return hasChanged ? nextBattleTeamIds : current;
    });
  }, [battleTeamOptions]);

  useEffect(() => {
    const nextSpValues = getEntrySpValues(initialEntry);

    setPokemonQuery(initialEntry?.pokemonName ?? "");
    setNickname(initialEntry?.nickname ?? "");
    setMemo(initialEntry?.memo ?? "");
    setSelectedAbility(initialEntry?.abilityName ?? "");
    setItemQuery(initialEntry?.itemName ?? "");
    setMoveQueries(getEntryMoveQueries(initialEntry));
    setSelectedNature(initialEntry?.natureName ?? "まじめ");
    setSelectedBattleTeamIds(findAssignedBattleTeamIds(battleTeams, initialEntry));
    setDraftBattleTeams([]);
    setNewBattleTeamName("");
    setSpValues(nextSpValues);
    setSpInputValues(createSpInputState(nextSpValues));
    setSelectedPokemon(findExactRecord(pokemonList, initialEntry?.pokemonName ?? ""));
    setSelectedItem(findExactRecord(itemList, initialEntry?.itemName ?? ""));
    setSelectedMoves(
      getEntryMoveQueries(initialEntry).map((query) => findExactRecord(moveList, query)),
    );
    setIsNatureTableOpen(false);
    setIsBattleTeamModalOpen(false);
    setDraggingSpStatKey(null);
    setAutoAdjustNotice("");
    setBattleTeamNotice(null);
    setSaveNotice(null);
  }, [initialEntry?.id]);

  function selectPokemon(name) {
    setAutoAdjustNotice("");
    startTransition(() => {
      setPokemonQuery(name);
    });
  }

  function selectItem(name) {
    setAutoAdjustNotice("");
    startTransition(() => {
      setItemQuery(name);
    });
  }

  function selectNature(natureName) {
    setAutoAdjustNotice("");
    setSelectedNature(natureName);
    setIsNatureTableOpen(false);
  }

  function openBattleTeamModal() {
    setSaveNotice(null);
    setBattleTeamNotice(null);
    setIsBattleTeamModalOpen(true);
  }

  function closeBattleTeamModal() {
    setBattleTeamNotice(null);
    setIsBattleTeamModalOpen(false);
  }

  function toggleBattleTeamSelection(teamId) {
    const targetTeam = battleTeamOptions.find((team) => team.id === teamId);
    if (!targetTeam || targetTeam.isDisabled) {
      return;
    }

    setSaveNotice(null);
    setBattleTeamNotice(null);
    setSelectedBattleTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((selectedTeamId) => selectedTeamId !== teamId)
        : [...current, teamId],
    );
  }

  function addBattleTeamSelection() {
    if (!normalizedNewBattleTeamName) {
      setBattleTeamNotice({
        tone: "error",
        message: "新規チーム名を入力してください。",
      });
      return;
    }

    const existingTeam = battleTeamOptions.find(
      (team) => normalizeBattleTeamName(team.name) === normalizedNewBattleTeamName,
    );

    if (existingTeam) {
      if (existingTeam.isDisabled) {
        setBattleTeamNotice({
          tone: "error",
          message: `${existingTeam.name} は6匹です。`,
        });
        return;
      }

      setSelectedBattleTeamIds((current) =>
        current.includes(existingTeam.id) ? current : [...current, existingTeam.id],
      );
      setNewBattleTeamName("");
      setBattleTeamNotice(null);
      return;
    }

    const draftTeam = {
      id: createDraftBattleTeamId(),
      name: normalizedNewBattleTeamName,
    };

    setDraftBattleTeams((current) => [...current, draftTeam]);
    setSelectedBattleTeamIds((current) => [...current, draftTeam.id]);
    setNewBattleTeamName("");
    setBattleTeamNotice(null);
  }

  function getMaxAssignableSp(statKey, values = spValues) {
    const spentWithoutCurrent = Object.entries(values)
      .filter(([key]) => key !== statKey)
      .reduce((sum, [, value]) => sum + value, 0);

    return Math.max(0, Math.min(MAX_SP_PER_STAT, TOTAL_SP_LIMIT - spentWithoutCurrent));
  }

  function normalizeSpValue(values, statKey, nextValue) {
    const clampedBaseValue = Math.max(0, Math.min(MAX_SP_PER_STAT, nextValue));
    return Math.min(clampedBaseValue, getMaxAssignableSp(statKey, values));
  }

  function applySpValue(statKey, nextValue, formatInputValue) {
    setSpValues((current) => {
      const normalizedValue = normalizeSpValue(current, statKey, nextValue);

      setSpInputValues((currentInputs) => ({
        ...currentInputs,
        [statKey]: formatInputValue(normalizedValue),
      }));

      return {
        ...current,
        [statKey]: normalizedValue,
      };
    });
  }

  function updateSp(statKey, nextRawValue) {
    setAutoAdjustNotice("");
    const digitsOnly = nextRawValue.replace(/[^\d]/g, "");
    const parsed = Number.parseInt(digitsOnly, 10);

    applySpValue(statKey, Number.isFinite(parsed) ? parsed : 0, (normalizedValue) =>
      digitsOnly === "" ? "" : String(normalizedValue),
    );
  }

  function updateSpFromBar(statKey, nextRawValue) {
    setAutoAdjustNotice("");
    const parsed = Number.parseInt(nextRawValue, 10);

    applySpValue(statKey, Number.isFinite(parsed) ? parsed : 0, (normalizedValue) =>
      String(normalizedValue),
    );
  }

  function startSpDrag(statKey, nextRawValue) {
    setDraggingSpStatKey(statKey);
    updateSpFromBar(statKey, nextRawValue);
  }

  function continueSpDrag(statKey, nextRawValue) {
    if (draggingSpStatKey !== statKey) {
      return;
    }

    updateSpFromBar(statKey, nextRawValue);
  }

  function isSpBarZeroZone(event) {
    const sliderStyles = window.getComputedStyle(event.currentTarget);
    const paddingLeft = Number.parseFloat(sliderStyles.paddingLeft) || 0;
    const sliderRect = event.currentTarget.getBoundingClientRect();
    return event.clientX <= sliderRect.left + paddingLeft;
  }

  function handleSpBarPointerDown(statKey, event) {
    if (event.target !== event.currentTarget || !isSpBarZeroZone(event)) {
      return;
    }

    event.preventDefault();
    startSpDrag(statKey, "0");
  }

  function handleSpBarPointerMove(statKey, event) {
    if (draggingSpStatKey !== statKey || !isSpBarZeroZone(event)) {
      return;
    }

    updateSpFromBar(statKey, "0");
  }

  function handleSpBarPointerLeave(statKey, event) {
    if (draggingSpStatKey !== statKey) {
      return;
    }

    const sliderRect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < sliderRect.left) {
      updateSpFromBar(statKey, "0");
    }
  }

  function resetSp() {
    setAutoAdjustNotice("");
    setSpValues({ ...defaultSpValues });
    setSpInputValues({ ...defaultSpInputValues });
  }

  function calculateConfiguredStatValue(statKey, spValue, natureName) {
    if (!selectedPokemon) {
      return null;
    }

    const base = selectedPokemon.stats[statKey];

    if (statKey === "hp") {
      return base + 15 + spValue + 60;
    }

    return Math.floor((base + 15 + spValue + 5) * getNatureMultiplier(natureName, statKey));
  }

  function getEffectiveSpecialDefenseValue(specialDefenseValue) {
    if (selectedItem?.name !== "とつげきチョッキ") {
      return specialDefenseValue;
    }

    return Math.floor(specialDefenseValue * 1.5);
  }

  function findBestDefensiveAdjustment(mode) {
    if (!selectedPokemon) {
      return null;
    }

    const defensiveNatureCandidates = getDefensiveNatureCandidates(selectedPokemon);
    const fixedSpTotal = Object.entries(spValues)
      .filter(([statKey]) => !DEFENSIVE_AUTO_KEYS.includes(statKey))
      .reduce((sum, [, value]) => sum + value, 0);
    const defensiveBudget = Math.max(0, TOTAL_SP_LIMIT - fixedSpTotal);
    let bestResult = null;

    for (const nature of defensiveNatureCandidates) {
      const natureName = nature.name;
      const maxHpSp = Math.min(MAX_SP_PER_STAT, defensiveBudget);

      for (let hp = 0; hp <= maxHpSp; hp += 1) {
        const maxDefenseSp = Math.min(MAX_SP_PER_STAT, defensiveBudget - hp);

        for (let defense = 0; defense <= maxDefenseSp; defense += 1) {
          const maxSpecialDefenseSp = Math.min(MAX_SP_PER_STAT, defensiveBudget - hp - defense);

          for (let specialDefense = 0; specialDefense <= maxSpecialDefenseSp; specialDefense += 1) {
            const hpValue = calculateConfiguredStatValue("hp", hp, natureName);
            const defenseValue = calculateConfiguredStatValue("defense", defense, natureName);
            const rawSpecialDefenseValue = calculateConfiguredStatValue(
              "specialDefense",
              specialDefense,
              natureName,
            );
            const specialDefenseValue = getEffectiveSpecialDefenseValue(rawSpecialDefenseValue);
            const equalityDifference = Math.abs(hpValue - (defenseValue + specialDefenseValue));
            const defensiveScore =
              (hpValue * defenseValue * specialDefenseValue) / (defenseValue + specialDefenseValue);
            const physicalBulk = hpValue * defenseValue;
            const specialBulk = hpValue * specialDefenseValue;
            const totalDefensiveSp = hp + defense + specialDefense;
            const candidate = {
              natureName,
              hp,
              defense,
              specialDefense,
              defensiveScore,
              physicalBulk,
              specialBulk,
              equalityDifference,
              totalDefensiveSp,
            };

            if (!bestResult) {
              bestResult = candidate;
              continue;
            }

            if (mode === "equalize") {
              const candidateIsExact = candidate.equalityDifference === 0;
              const bestIsExact = bestResult.equalityDifference === 0;

              if (candidateIsExact !== bestIsExact) {
                if (candidateIsExact) {
                  bestResult = candidate;
                }
                continue;
              }

              if (!candidateIsExact && candidate.equalityDifference !== bestResult.equalityDifference) {
                if (candidate.equalityDifference < bestResult.equalityDifference) {
                  bestResult = candidate;
                }
                continue;
              }
            }

            if (candidate.defensiveScore !== bestResult.defensiveScore) {
              if (candidate.defensiveScore > bestResult.defensiveScore) {
                bestResult = candidate;
              }
              continue;
            }

            if (mode === "maximize-defense" && candidate.physicalBulk !== bestResult.physicalBulk) {
              if (candidate.physicalBulk > bestResult.physicalBulk) {
                bestResult = candidate;
              }
              continue;
            }

            if (mode === "maximize-specialDefense" && candidate.specialBulk !== bestResult.specialBulk) {
              if (candidate.specialBulk > bestResult.specialBulk) {
                bestResult = candidate;
              }
              continue;
            }

            if (candidate.totalDefensiveSp < bestResult.totalDefensiveSp) {
              bestResult = candidate;
            }
          }
        }
      }
    }

    if (!bestResult) {
      return null;
    }

    return {
      natureName: bestResult.natureName,
      spValues: {
        ...spValues,
        hp: bestResult.hp,
        defense: bestResult.defense,
        specialDefense: bestResult.specialDefense,
      },
      equalityDifference: bestResult.equalityDifference,
    };
  }

  function applyDefensiveAdjustment(mode) {
    const result = findBestDefensiveAdjustment(mode);
    if (!result) {
      return;
    }

    setSelectedNature(result.natureName);
    setSpValues(result.spValues);
    setSpInputValues(createSpInputState(result.spValues));

    if (mode === "equalize") {
      setAutoAdjustNotice(
        result.equalityDifference === 0
          ? "HP=防御+特防 になる配分を適用しました。"
          : "完全一致がなかったため、最も近い配分を適用しました。",
      );
      return;
    }

    setAutoAdjustNotice(
      mode === "maximize-specialDefense"
        ? "特防指数が最大になる配分を適用しました。"
        : "防御指数が最大になる配分を適用しました。",
    );
  }

  function calculateStatValue(statKey) {
    if (!selectedPokemon) {
      return "—";
    }

    const base = selectedPokemon.stats[statKey];
    const sp = spValues[statKey];

    if (statKey === "hp") {
      return base + 15 + sp + 60;
    }

    const multiplier = getNatureMultiplier(selectedNature, statKey);
    return Math.floor((base + 15 + sp + 5) * multiplier);
  }

  function getBaseStatValue(statKey) {
    return selectedPokemon?.stats[statKey] ?? "—";
  }

  function handleSave() {
    if (!selectedPokemon || !onSave) {
      return;
    }

    const actualStats = Object.fromEntries(
      statCards.map((stat) => [
        stat.key,
        calculateConfiguredStatValue(stat.key, spValues[stat.key], selectedNature),
      ]),
    );
    const trimmedItemName = itemQuery.trim();
    const selectedDraftBattleTeamIds = new Set(draftBattleTeams.map((team) => team.id));
    const selectedExistingBattleTeamIds = selectedBattleTeamIds.filter(
      (teamId) => !selectedDraftBattleTeamIds.has(teamId),
    );
    const selectedNewBattleTeamNames = draftBattleTeams
      .filter((team) => selectedBattleTeamIds.includes(team.id))
      .map((team) => team.name);

    const saveResult = onSave({
      id: initialEntry?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
      pokemonName: selectedPokemon.name,
      nickname: nickname.trim(),
      abilityName: selectedAbility,
      itemName: trimmedItemName || "",
      natureName: selectedNature,
      memo: memo.trim(),
      moves: selectedMoves.map((move) =>
        move
          ? {
              name: move.name,
              type: move.type,
              moveKind: move.moveKind,
              attackClass: move.attackClass,
              power: move.power,
              pp: move.pp,
              effect: move.effect,
            }
          : null,
      ),
      spValues: { ...spValues },
      actualStats,
      battleTeamIds: selectedExistingBattleTeamIds,
      newBattleTeamNames: selectedNewBattleTeamNames,
    });

    if (!saveResult?.ok) {
      setSaveNotice({
        tone: "error",
        message: saveResult?.message ?? "保存できませんでした。",
      });
      return;
    }

    setSelectedBattleTeamIds(saveResult.battleTeamIds ?? []);
    setDraftBattleTeams([]);
    setNewBattleTeamName("");
    setBattleTeamNotice(null);
    setIsBattleTeamModalOpen(false);
    setSaveNotice({
      tone: "success",
      message: saveNoticeLabel,
    });
  }

  function updateMoveQuery(slotIndex, nextValue) {
    setMoveQueries((current) => current.map((value, index) => (index === slotIndex ? nextValue : value)));
  }

  function selectMove(slotIndex, name) {
    startTransition(() => {
      setMoveQueries((current) => current.map((value, index) => (index === slotIndex ? name : value)));
    });
  }

  const configuredActualStats = selectedPokemon
    ? Object.fromEntries(
        statCards.map((stat) => [
          stat.key,
          calculateConfiguredStatValue(stat.key, spValues[stat.key], selectedNature),
        ]),
      )
    : null;

  return (
    <div className="view-shell view-shell--training">
      <header className="topbar">
        <button className="ghost-button" type="button" onClick={onBack}>
          {backLabel}
        </button>
        <div className="topbar__actions">
          <button className="ghost-button" type="button" disabled={!canSave} onClick={handleSave}>
            {saveButtonLabel}
          </button>
          {saveNotice ? (
            <span className={`save-notice save-notice--${saveNotice.tone}`}>{saveNotice.message}</span>
          ) : null}
        </div>
      </header>

      <section className="training-layout">
        <div className="training-layout__top-row">
          <div className="panel panel--strong training-step training-panel-main training-layout__primary">
          <div className="field-grid field-grid--stack">
            <AutocompleteInput
              label="名前"
              value={pokemonQuery}
              placeholder="例: ガブリアス"
              suggestions={pokemonSuggestions}
              onChange={setPokemonQuery}
              onSelect={selectPokemon}
            />

            <label className="field">
              <span className="field__label">ニックネーム</span>
              <input
                className="field__input"
                type="text"
                value={nickname}
                placeholder="任意"
                onChange={(event) => setNickname(event.target.value)}
              />
            </label>

            <AutocompleteInput
              label="持ち物"
              value={itemQuery}
              placeholder="例: いのちのたま"
              suggestions={itemSuggestions}
              onChange={setItemQuery}
              onSelect={selectItem}
              helper={isMegaStoneLocked ? `${megaStoneItemName} に固定されています。` : ""}
              disabled={isMegaStoneLocked}
            />

            {itemEffectMessage ? <div className="item-effect-box">{itemEffectMessage}</div> : null}
          </div>

          <div className="field">
            <span className="field__label">性格</span>
            <div className="nature-field">
              <div className="nature-field__info">
                <strong>{selectedNature}</strong>
                <small>{getNatureSummary(selectedNature)}</small>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setIsNatureTableOpen((current) => !current)}
              >
                {isNatureTableOpen ? "性格補正表を閉じる" : "性格選択"}
              </button>
            </div>
          </div>

          <div className="team-selection-stack">
            <div className="field">
              <span className="field__label">バトルチーム選択</span>
              <div className="team-selection-stack__controls">
                <button className="ghost-button" type="button" onClick={openBattleTeamModal}>
                  バトルチーム選択
                </button>
                <span className="team-selection-stack__summary">
                  {selectedBattleTeamNames.length > 0
                    ? `${selectedBattleTeamNames.length}チーム選択中`
                    : "未選択"}
                </span>
              </div>
            </div>

            <div className="team-selection-chip-list">
              {selectedBattleTeamNames.length > 0 ? (
                selectedBattleTeamNames.map((teamName) => (
                  <span key={teamName} className="team-selection-chip">
                    {teamName}
                  </span>
                ))
              ) : (
                <span className="team-selection-chip team-selection-chip--empty">未選択</span>
              )}
            </div>

            {battleTeamNotice ? (
              <p
                className={`team-selection-note ${
                  battleTeamNotice.tone === "error" ? "team-selection-note--error" : ""
                }`}
              >
                {battleTeamNotice.message}
              </p>
            ) : null}
          </div>

          {selectedPokemon ? (
            <div className="ability-panel">
              <div className="ability-panel__header">
                <h3>特性</h3>
              </div>
              <div className="ability-list">
                {selectedPokemon.abilityOptions.map((ability) => (
                  <button
                    key={ability.name}
                    className={`ability-chip ${selectedAbility === ability.name ? "ability-chip--selected" : ""}`}
                    type="button"
                    onClick={() => setSelectedAbility(ability.name)}
                  >
                    <span>{ability.name}</span>
                    <small>{ability.isHidden ? "夢特性" : "通常特性"}</small>
                  </button>
                ))}
              </div>
              {selectedAbility ? (
                <p className="ability-effect">
                  {
                    selectedPokemon.abilityOptions.find((ability) => ability.name === selectedAbility)?.effect
                  }
                </p>
              ) : null}
            </div>
          ) : (
            <div className="empty-box">ポケモンを確定すると特性一覧を表示します。</div>
          )}

          <label className="field">
            <span className="field__label">メモ</span>
            <textarea
              className="field__textarea"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </label>

          </div>
          <div className="panel panel--soft training-step training-panel-main training-step--merged training-layout__merged">
          <div className="move-grid">
            {moveQueries.map((moveQuery, index) => {
              const selectedMove = selectedMoves[index];

              return (
                <article
                  key={`move-slot-${index}`}
                  className={`move-card ${getMoveTypeClassName(selectedMove?.type)}`.trim()}
                >
                  <AutocompleteInput
                    label={`技${index + 1}`}
                    value={moveQuery}
                    placeholder="例: じしん"
                    suggestions={moveSuggestions[index]}
                    onChange={(value) => updateMoveQuery(index, value)}
                    onSelect={(name) => selectMove(index, name)}
                  />

                  {selectedMove ? (
                    <div className="move-card__details">
                      <p className="move-card__detail-line">
                        <span>タイプ</span>
                        <strong>{selectedMove.type}</strong>
                      </p>
                      <p className="move-card__detail-line">
                        <span>技の種類</span>
                        <strong>{selectedMove.moveKind}</strong>
                      </p>
                      {selectedMove.moveKind === "攻撃技" ? (
                        <p className="move-card__detail-line">
                          <span>分類 / 威力</span>
                          <strong>
                            {selectedMove.attackClass} / {selectedMove.power ?? "—"}
                          </strong>
                        </p>
                      ) : null}
                      <p className="move-card__detail-line">
                        <span>PP</span>
                        <strong>{selectedMove.pp}</strong>
                      </p>
                      <p className="move-card__effect">{selectedMove.effect}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="training-step__summary">
            <div className="sp-summary">
              <div className="sp-summary__main">
                <div className="sp-meter">
                  <div
                    className="sp-meter__fill"
                    style={{ width: `${(totalSp / TOTAL_SP_LIMIT) * 100}%` }}
                  />
                </div>
                <div className="sp-summary__text">
                  <strong>{totalSp} / {TOTAL_SP_LIMIT}</strong>
                  <span>残り {remainingSp}</span>
                </div>
              </div>
              <button className="ghost-button sp-summary__reset" type="button" onClick={resetSp}>
                SPをリセット
              </button>
            </div>
          </div>

          <div className="merged-stat-grid">
            {statCards.map((stat) => {
              const tone = getStatTone(selectedNature, stat.key);
              const currentSpValue = spValues[stat.key];
              const maxAssignableSp = getMaxAssignableSp(stat.key);

              return (
                <article key={stat.key} className="merged-stat-card">
                  <div className="merged-stat-card__compact">
                    <p className={`stat-card__label stat-tone stat-tone--${tone}`}>{stat.label}</p>
                    <div className="stat-card__base" aria-label={`${stat.label}の種族値`}>
                      <strong className="stat-card__base-value">{getBaseStatValue(stat.key)}</strong>
                    </div>
                    <div
                      className="sp-segment-slider"
                      onPointerDown={(event) => handleSpBarPointerDown(stat.key, event)}
                      onPointerMove={(event) => handleSpBarPointerMove(stat.key, event)}
                      onPointerLeave={(event) => handleSpBarPointerLeave(stat.key, event)}
                    >
                      <div className="sp-segment-slider__bars">
                        {Array.from({ length: SP_SEGMENT_COUNT }, (_, index) => {
                          const segmentState =
                            index < currentSpValue
                              ? "sp-segment-slider__segment--active"
                              : index < maxAssignableSp
                                ? "sp-segment-slider__segment--inactive"
                                : "sp-segment-slider__segment--locked";
                          const isLocked = index >= maxAssignableSp;

                          return (
                            <button
                              key={`${stat.key}-${index}`}
                              type="button"
                              className={`sp-segment-slider__segment ${segmentState}`}
                              tabIndex={-1}
                              aria-hidden="true"
                              disabled={isLocked}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                startSpDrag(stat.key, String(index + 1));
                              }}
                              onPointerEnter={() => continueSpDrag(stat.key, String(index + 1))}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      aria-label={`${stat.label}のSP`}
                      value={spInputValues[stat.key]}
                      onChange={(event) => updateSp(stat.key, event.target.value)}
                    />
                    <strong className="stat-card__value">{calculateStatValue(stat.key)}</strong>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="stat-card__actions">
            <p className="stat-card__actions-title">耐久自動調整</p>
            <button
              className="ghost-button stat-card__action-button"
              type="button"
              disabled={!selectedPokemon}
              onClick={() => applyDefensiveAdjustment("equalize")}
            >
              HP=防御+特防
            </button>
            <button
              className="ghost-button stat-card__action-button"
              type="button"
              disabled={!selectedPokemon}
              onClick={() => applyDefensiveAdjustment("maximize-defense")}
            >
              <span className="stat-card__action-formula">(HP×防御×特防)÷(防御＋特防)</span>
              <span className="stat-card__action-target">
                <span className="stat-card__action-target-highlight">防御</span>
                指数最大
              </span>
            </button>
            <button
              className="ghost-button stat-card__action-button"
              type="button"
              disabled={!selectedPokemon}
              onClick={() => applyDefensiveAdjustment("maximize-specialDefense")}
            >
              <span className="stat-card__action-formula">(HP×防御×特防)÷(防御＋特防)</span>
              <span className="stat-card__action-target">
                <span className="stat-card__action-target-highlight">特防</span>
                指数最大
              </span>
            </button>
            {autoAdjustNotice ? <p className="stat-card__notice">{autoAdjustNotice}</p> : null}
          </div>
          </div>
        </div>

        <div className="training-layout__bottom-row">
          <DamageCalculatorPanel
            className="training-layout__deal"
            mode="deal"
            title="与ダメージ計算"
            sourcePokemon={selectedPokemon}
            sourceActualStats={configuredActualStats}
            sourceMoves={selectedMoves}
          />

          <DamageCalculatorPanel
            className="training-layout__take"
            mode="take"
            title="被ダメージ計算"
            sourcePokemon={selectedPokemon}
            sourceActualStats={configuredActualStats}
          />
        </div>
      </section>

      <BattleTeamSelectorModal
        isOpen={isBattleTeamModalOpen}
        teamOptions={battleTeamOptions}
        newTeamName={newBattleTeamName}
        notice={battleTeamNotice}
        onClose={closeBattleTeamModal}
        onToggleTeam={toggleBattleTeamSelection}
        onNewTeamNameChange={(value) => {
          setSaveNotice(null);
          setBattleTeamNotice(null);
          setNewBattleTeamName(value);
        }}
        onCreateTeam={addBattleTeamSelection}
      />

      {isNatureTableOpen ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setIsNatureTableOpen(false)}
        >
          <div
            className="modal-window"
            role="dialog"
            aria-modal="true"
            aria-label="性格補正表"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-window__header">
              <div>
                <p className="section-heading__eyebrow">Nature</p>
                <h2>性格補正表</h2>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setIsNatureTableOpen(false)}
              >
                閉じる
              </button>
            </div>
            <NatureMatrix
              selectedNature={selectedNature}
              onSelectNature={selectNature}
              showHeader={false}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
