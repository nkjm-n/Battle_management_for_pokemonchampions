import { startTransition, useEffect, useState } from "react";
import BattleTeamDetailView from "./components/BattleTeamDetailView";
import BattleTeamsView from "./components/BattleTeamsView";
import TrainingStartView from "./components/TrainingStartView";
import TrainedPokemonView from "./components/TrainedPokemonView";
import {
  MAX_BATTLE_TEAM_SIZE,
  createBattleTeamId,
  findAssignedBattleTeamId,
  findBattleTeamById,
  findBattleTeamByName,
  normalizeBattleTeams,
  normalizeBattleTeamName,
} from "./lib/battleTeams";
import {
  loadBattleTeamsFromStorage,
  loadSavedPokemonFromStorage,
  saveBattleTeamsToStorage,
  saveSavedPokemonToStorage,
} from "./lib/savedPokemonStorage";

const homeCards = [
  {
    id: "training",
    title: "育成開始",
    eyebrow: "Calculator",
    description: "ポケモン名・特性・持ち物・SP振り・性格補正から実数値を組み立てます。",
    status: "available",
  },
  {
    id: "trained",
    title: "育成済みポケモン",
    eyebrow: "Archive",
    description: "保存した個体を一覧で確認できます。",
    status: "available",
  },
  {
    id: "teams",
    title: "バトルチーム",
    eyebrow: "Roster",
    description: "登録したチームごとに、所属ポケモン6匹をまとめて確認できます。",
    status: "available",
  },
];

export default function App() {
  const [activeView, setActiveView] = useState("home");
  const [savedPokemon, setSavedPokemon] = useState([]);
  const [battleTeams, setBattleTeams] = useState([]);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [editingPokemonId, setEditingPokemonId] = useState(null);
  const [viewingBattleTeamId, setViewingBattleTeamId] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    Promise.all([loadSavedPokemonFromStorage(), loadBattleTeamsFromStorage()])
      .then(([loadedPokemon, loadedBattleTeams]) => {
        if (isCancelled) {
          return;
        }

        setSavedPokemon(loadedPokemon);
        setBattleTeams(normalizeBattleTeams(loadedBattleTeams));
        setIsStorageReady(true);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setSavedPokemon([]);
        setBattleTeams([]);
        setIsStorageReady(true);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    void saveSavedPokemonToStorage(savedPokemon);
  }, [savedPokemon, isStorageReady]);

  useEffect(() => {
    if (!isStorageReady) {
      return;
    }

    void saveBattleTeamsToStorage(battleTeams);
  }, [battleTeams, isStorageReady]);

  function moveTo(view) {
    startTransition(() => {
      setActiveView(view);
    });
  }

  function openTrainingForCreate() {
    setEditingPokemonId(null);
    moveTo("training");
  }

  function openTrainingForEdit(entryId) {
    setEditingPokemonId(entryId);
    moveTo("training");
  }

  function openBattleTeamDetail(teamId) {
    setViewingBattleTeamId(teamId);
    moveTo("teamDetail");
  }

  function handleDeleteBattleTeam(teamId) {
    setBattleTeams((current) => current.filter((team) => team.id !== teamId));
    setSavedPokemon((current) =>
      current.map((entry) =>
        entry.battleTeamId === teamId
          ? {
              ...entry,
              battleTeamId: null,
              battleTeamName: "",
            }
          : entry,
      ),
    );

    if (viewingBattleTeamId === teamId) {
      setViewingBattleTeamId(null);
      moveTo("teams");
    }
  }

  function handleSavePokemon({ battleTeamId, newBattleTeamName, ...entry }) {
    const existingEntry = savedPokemon.find((savedEntry) => savedEntry.id === entry.id) ?? null;
    const normalizedBattleTeams = normalizeBattleTeams(battleTeams);
    const normalizedNewBattleTeamName = normalizeBattleTeamName(newBattleTeamName);
    let nextBattleTeams = normalizedBattleTeams;
    let targetBattleTeamId = battleTeamId || null;

    if (normalizedNewBattleTeamName) {
      const existingTeamByName = findBattleTeamByName(normalizedBattleTeams, normalizedNewBattleTeamName);

      if (existingTeamByName) {
        targetBattleTeamId = existingTeamByName.id;
      } else {
        const createdAt = new Date().toISOString();
        const createdTeam = {
          id: createBattleTeamId(),
          name: normalizedNewBattleTeamName,
          pokemonIds: [],
          createdAt,
          updatedAt: createdAt,
        };

        nextBattleTeams = [createdTeam, ...normalizedBattleTeams];
        targetBattleTeamId = createdTeam.id;
      }
    }

    const previousBattleTeamId = findAssignedBattleTeamId(nextBattleTeams, existingEntry);
    const targetBattleTeam = findBattleTeamById(nextBattleTeams, targetBattleTeamId);
    const isAlreadyAssignedToTargetTeam =
      targetBattleTeam?.pokemonIds.includes(entry.id) || previousBattleTeamId === targetBattleTeamId;

    if (targetBattleTeam && !isAlreadyAssignedToTargetTeam && targetBattleTeam.pokemonIds.length >= MAX_BATTLE_TEAM_SIZE) {
      return {
        ok: false,
        message: "このバトルチームは6匹までです。",
      };
    }

    const touchedAt = new Date().toISOString();
    const nextSavedEntry = {
      ...entry,
      battleTeamId: targetBattleTeam?.id ?? null,
      battleTeamName: targetBattleTeam?.name ?? "",
    };

    setSavedPokemon((current) => {
      const existingEntryIndex = current.findIndex((savedEntry) => savedEntry.id === nextSavedEntry.id);

      if (existingEntryIndex === -1) {
        return [nextSavedEntry, ...current];
      }

      return current.map((savedEntry) =>
        savedEntry.id === nextSavedEntry.id ? nextSavedEntry : savedEntry,
      );
    });
    setBattleTeams(
      nextBattleTeams.map((team) => {
        const previousPokemonIds = team.pokemonIds;
        const filteredPokemonIds = previousPokemonIds.filter((pokemonId) => pokemonId !== entry.id);
        const nextPokemonIds =
          team.id === targetBattleTeam?.id ? [...filteredPokemonIds, entry.id] : filteredPokemonIds;
        const didChange =
          nextPokemonIds.length !== previousPokemonIds.length ||
          nextPokemonIds.some((pokemonId, index) => pokemonId !== previousPokemonIds[index]);

        return didChange
          ? {
              ...team,
              pokemonIds: nextPokemonIds,
              updatedAt: touchedAt,
            }
          : team;
      }),
    );

    return {
      ok: true,
      battleTeamId: targetBattleTeam?.id ?? null,
    };
  }

  function handleDeletePokemon(entryId) {
    const touchedAt = new Date().toISOString();
    setSavedPokemon((current) => current.filter((entry) => entry.id !== entryId));
    setBattleTeams((current) =>
      current.map((team) => {
        if (!team.pokemonIds?.includes(entryId)) {
          return team;
        }

        return {
          ...team,
          pokemonIds: team.pokemonIds.filter((pokemonId) => pokemonId !== entryId),
          updatedAt: touchedAt,
        };
      }),
    );
  }

  const editingPokemon =
    editingPokemonId == null
      ? null
      : savedPokemon.find((entry) => entry.id === editingPokemonId) ?? null;
  const viewingBattleTeam =
    viewingBattleTeamId == null
      ? null
      : battleTeams.find((team) => team.id === viewingBattleTeamId) ?? null;

  if (!isStorageReady) {
    return (
      <main className="app-shell">
        <section className="panel panel--soft placeholder-panel">
          <p className="section-heading__eyebrow">Loading</p>
          <h1>データを読み込み中</h1>
          <p>端末内に保存された育成データを確認しています。</p>
        </section>
      </main>
    );
  }

  if (activeView === "training") {
    return (
      <TrainingStartView
        battleTeams={battleTeams}
        initialEntry={editingPokemon}
        backLabel={editingPokemon ? "一覧へ戻る" : "ホームへ戻る"}
        onBack={() => moveTo(editingPokemon ? "trained" : "home")}
        onSave={handleSavePokemon}
      />
    );
  }

  if (activeView === "trained") {
    return (
      <TrainedPokemonView
        savedPokemon={savedPokemon}
        onBack={() => moveTo("home")}
        onEdit={openTrainingForEdit}
        onDelete={handleDeletePokemon}
      />
    );
  }

  if (activeView === "teams") {
    return (
      <BattleTeamsView
        battleTeams={battleTeams}
        savedPokemon={savedPokemon}
        onBack={() => moveTo("home")}
        onDeleteTeam={handleDeleteBattleTeam}
        onSelectTeam={openBattleTeamDetail}
      />
    );
  }

  if (activeView === "teamDetail") {
    return (
      <BattleTeamDetailView
        team={viewingBattleTeam}
        savedPokemon={savedPokemon}
        onBack={() => moveTo("teams")}
      />
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero__main">
          <p className="hero__eyebrow">バトルチーム管理 for pokemonchampions</p>
          <p className="hero__copy">
            現在：メガシンカ未実装
          </p>
        </div>
      </section>

      <section className="home-grid">
        {homeCards.map((card) => (
          <button
            key={card.id}
            className={`home-card ${card.status === "available" ? "home-card--active" : ""}`}
            type="button"
            onClick={() => (card.id === "training" ? openTrainingForCreate() : moveTo(card.id))}
          >
            <div className="home-card__header">
              <span>{card.eyebrow}</span>
              <strong>{card.title}</strong>
            </div>
            <p>{card.description}</p>
            <span className={`home-card__status home-card__status--${card.status}`}>
              {card.status === "available" ? "実装済み" : "準備中"}
            </span>
          </button>
        ))}
      </section>
    </main>
  );
}
