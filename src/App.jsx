import { startTransition, useEffect, useState } from "react";
import BattleTeamDetailView from "./components/BattleTeamDetailView";
import BattleTeamReorderView from "./components/BattleTeamReorderView";
import BattleTeamsView from "./components/BattleTeamsView";
import TrainingStartView from "./components/TrainingStartView";
import TrainedPokemonView from "./components/TrainedPokemonView";
import {
  MAX_BATTLE_TEAM_SIZE,
  createBattleTeamId,
  findAssignedBattleTeamIds,
  findBattleTeamByName,
  getBattleTeamIdsByPokemonId,
  getBattleTeamNamesByIds,
  normalizeBattleTeams,
  normalizeBattleTeamName,
} from "./lib/battleTeams";
import {
  loadBattleTeamsFromStorage,
  loadSavedPokemonFromStorage,
  saveBattleTeamsToStorage,
  saveSavedPokemonToStorage,
} from "./lib/savedPokemonStorage";

const defaultRouteState = {
  view: "home",
  editingPokemonId: null,
  viewingBattleTeamId: null,
};

const defaultTrainingBackRoute = {
  view: "home",
  editingPokemonId: null,
  viewingBattleTeamId: null,
};

function parseHashRoute(hash) {
  const normalizedHash = String(hash ?? "").replace(/^#/, "");
  const segments = normalizedHash.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { ...defaultRouteState };
  }

  if (segments[0] === "training") {
    return {
      view: "training",
      editingPokemonId: segments[1] ? decodeURIComponent(segments[1]) : null,
      viewingBattleTeamId: null,
    };
  }

  if (segments[0] === "trained") {
    return {
      view: "trained",
      editingPokemonId: null,
      viewingBattleTeamId: null,
    };
  }

  if (segments[0] === "teams" && segments[1] && segments[2] === "swap") {
    return {
      view: "teamReorder",
      editingPokemonId: null,
      viewingBattleTeamId: decodeURIComponent(segments[1]),
    };
  }

  if (segments[0] === "teams" && segments[1]) {
    return {
      view: "teamDetail",
      editingPokemonId: null,
      viewingBattleTeamId: decodeURIComponent(segments[1]),
    };
  }

  if (segments[0] === "teams") {
    return {
      view: "teams",
      editingPokemonId: null,
      viewingBattleTeamId: null,
    };
  }

  return { ...defaultRouteState };
}

function buildHashRoute({ view, editingPokemonId, viewingBattleTeamId }) {
  if (view === "training") {
    return editingPokemonId ? `#/training/${encodeURIComponent(editingPokemonId)}` : "#/training";
  }

  if (view === "trained") {
    return "#/trained";
  }

  if (view === "teamDetail" && viewingBattleTeamId) {
    return `#/teams/${encodeURIComponent(viewingBattleTeamId)}`;
  }

  if (view === "teamReorder" && viewingBattleTeamId) {
    return `#/teams/${encodeURIComponent(viewingBattleTeamId)}/swap`;
  }

  if (view === "teams") {
    return "#/teams";
  }

  return "#/";
}

const homeCards = [
  {
    id: "training",
    title: "育成開始",
    tone: "training",
  },
  {
    id: "trained",
    title: "育成済みポケモン",
    tone: "trained",
  },
  {
    id: "teams",
    title: "バトルチーム",
    tone: "teams",
  },
];

function applyBattleTeamMembership(entries, teams) {
  const normalizedTeams = normalizeBattleTeams(teams);

  return entries.map((entry) => {
    const nextBattleTeamIds = getBattleTeamIdsByPokemonId(normalizedTeams, entry.id);
    const nextBattleTeamNames = getBattleTeamNamesByIds(normalizedTeams, nextBattleTeamIds);

    return {
      ...entry,
      battleTeamIds: nextBattleTeamIds,
      battleTeamNames: nextBattleTeamNames,
      battleTeamId: nextBattleTeamIds[0] ?? null,
      battleTeamName: nextBattleTeamNames[0] ?? "",
    };
  });
}

export default function App() {
  const initialRoute =
    typeof window === "undefined" ? defaultRouteState : parseHashRoute(window.location.hash);
  const [activeView, setActiveView] = useState(initialRoute.view);
  const [savedPokemon, setSavedPokemon] = useState([]);
  const [battleTeams, setBattleTeams] = useState([]);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [editingPokemonId, setEditingPokemonId] = useState(initialRoute.editingPokemonId);
  const [viewingBattleTeamId, setViewingBattleTeamId] = useState(initialRoute.viewingBattleTeamId);
  const [trainingBackRoute, setTrainingBackRoute] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function applyRouteFromLocation() {
      const nextRoute = parseHashRoute(window.location.hash);

      startTransition(() => {
        setActiveView(nextRoute.view);
        setEditingPokemonId(nextRoute.editingPokemonId);
        setViewingBattleTeamId(nextRoute.viewingBattleTeamId);
      });
    }

    if (!window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/`);
    }

    applyRouteFromLocation();
    window.addEventListener("hashchange", applyRouteFromLocation);

    return () => {
      window.removeEventListener("hashchange", applyRouteFromLocation);
    };
  }, []);

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

  function navigateTo(nextRoute) {
    const normalizedRoute = {
      ...defaultRouteState,
      ...nextRoute,
    };

    if (typeof window === "undefined") {
      startTransition(() => {
        setActiveView(normalizedRoute.view);
        setEditingPokemonId(normalizedRoute.editingPokemonId);
        setViewingBattleTeamId(normalizedRoute.viewingBattleTeamId);
      });
      return;
    }

    const nextHash = buildHashRoute(normalizedRoute);
    if (window.location.hash === nextHash) {
      startTransition(() => {
        setActiveView(normalizedRoute.view);
        setEditingPokemonId(normalizedRoute.editingPokemonId);
        setViewingBattleTeamId(normalizedRoute.viewingBattleTeamId);
      });
      return;
    }

    window.location.hash = nextHash.slice(1);
  }

  function moveTo(view) {
    navigateTo({ view });
  }

  function openTrainingForCreate(backRoute = defaultTrainingBackRoute) {
    setTrainingBackRoute({
      ...defaultTrainingBackRoute,
      ...backRoute,
    });
    navigateTo({ view: "training" });
  }

  function openTrainingForEdit(entryId, backRoute = { view: "trained" }) {
    setTrainingBackRoute({
      ...defaultTrainingBackRoute,
      ...backRoute,
    });
    navigateTo({ view: "training", editingPokemonId: entryId });
  }

  function openBattleTeamDetail(teamId) {
    navigateTo({ view: "teamDetail", viewingBattleTeamId: teamId });
  }

  function openBattleTeamReorder(teamId) {
    navigateTo({ view: "teamReorder", viewingBattleTeamId: teamId });
  }

  function handleDeleteBattleTeam(teamId) {
    const remainingBattleTeams = battleTeams.filter((team) => team.id !== teamId);

    setBattleTeams(remainingBattleTeams);
    setSavedPokemon((current) => applyBattleTeamMembership(current, remainingBattleTeams));

    if (viewingBattleTeamId === teamId) {
      navigateTo({ view: "teams" });
    }
  }

  function handleSavePokemon({ battleTeamIds = [], newBattleTeamNames = [], ...entry }) {
    const existingEntry = savedPokemon.find((savedEntry) => savedEntry.id === entry.id) ?? null;
    const normalizedBattleTeams = normalizeBattleTeams(battleTeams);
    let nextBattleTeams = normalizedBattleTeams;
    const selectedBattleTeamIds = new Set(
      Array.isArray(battleTeamIds)
        ? battleTeamIds.filter((teamId) => typeof teamId === "string" && teamId)
        : [],
    );
    const normalizedNewBattleTeamNames = Array.isArray(newBattleTeamNames)
      ? newBattleTeamNames
          .map((teamName) => normalizeBattleTeamName(teamName))
          .filter((teamName, index, teamNames) => teamName && teamNames.indexOf(teamName) === index)
      : [];

    for (const teamName of normalizedNewBattleTeamNames) {
      const existingTeamByName = findBattleTeamByName(nextBattleTeams, teamName);

      if (existingTeamByName) {
        selectedBattleTeamIds.add(existingTeamByName.id);
        continue;
      }

      const createdAt = new Date().toISOString();
      const createdTeam = {
        id: createBattleTeamId(),
        name: teamName,
        pokemonIds: [],
        createdAt,
        updatedAt: createdAt,
      };

      nextBattleTeams = [createdTeam, ...nextBattleTeams];
      selectedBattleTeamIds.add(createdTeam.id);
    }

    const previousBattleTeamIds = new Set(findAssignedBattleTeamIds(nextBattleTeams, existingEntry));
    const overLimitTeams = nextBattleTeams.filter(
      (team) =>
        selectedBattleTeamIds.has(team.id) &&
        !team.pokemonIds.includes(entry.id) &&
        !previousBattleTeamIds.has(team.id) &&
        team.pokemonIds.length >= MAX_BATTLE_TEAM_SIZE,
    );

    if (overLimitTeams.length > 0) {
      return {
        ok: false,
        message: `${overLimitTeams[0].name} は6匹です。`,
      };
    }

    const touchedAt = new Date().toISOString();
    const normalizedSelectedBattleTeamIds = [...selectedBattleTeamIds];
    const selectedBattleTeamNames = getBattleTeamNamesByIds(nextBattleTeams, normalizedSelectedBattleTeamIds);
    const nextSavedEntry = {
      ...entry,
      battleTeamIds: normalizedSelectedBattleTeamIds,
      battleTeamNames: selectedBattleTeamNames,
      battleTeamId: normalizedSelectedBattleTeamIds[0] ?? null,
      battleTeamName: selectedBattleTeamNames[0] ?? "",
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
        const nextPokemonIds = selectedBattleTeamIds.has(team.id)
          ? [...filteredPokemonIds, entry.id]
          : filteredPokemonIds;
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
      battleTeamIds: normalizedSelectedBattleTeamIds,
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

  function handleRemovePokemonFromBattleTeam(teamId, entryId) {
    const touchedAt = new Date().toISOString();
    const nextBattleTeams = battleTeams.map((team) => {
      if (team.id !== teamId || !team.pokemonIds?.includes(entryId)) {
        return team;
      }

      return {
        ...team,
        pokemonIds: team.pokemonIds.filter((pokemonId) => pokemonId !== entryId),
        updatedAt: touchedAt,
      };
    });

    setBattleTeams(nextBattleTeams);
    setSavedPokemon((current) => applyBattleTeamMembership(current, nextBattleTeams));
  }

  function handleReorderBattleTeam(teamId, nextPokemonIds) {
    const targetTeam = battleTeams.find((team) => team.id === teamId);
    if (!targetTeam) {
      return;
    }

    const validPokemonIdSet = new Set(savedPokemon.map((entry) => entry.id));
    const normalizedPokemonIds = Array.isArray(nextPokemonIds)
      ? nextPokemonIds.filter(
          (pokemonId, index, pokemonIds) =>
            typeof pokemonId === "string" &&
            validPokemonIdSet.has(pokemonId) &&
            pokemonIds.indexOf(pokemonId) === index,
        )
      : [];
    const trimmedPokemonIds = normalizedPokemonIds.slice(0, MAX_BATTLE_TEAM_SIZE);
    const hasChanged =
      trimmedPokemonIds.length !== targetTeam.pokemonIds.length ||
      trimmedPokemonIds.some((pokemonId, index) => pokemonId !== targetTeam.pokemonIds[index]);

    if (!hasChanged) {
      return;
    }

    const touchedAt = new Date().toISOString();
    const nextBattleTeams = battleTeams.map((team) =>
      team.id === teamId
        ? {
            ...team,
            pokemonIds: trimmedPokemonIds,
            updatedAt: touchedAt,
          }
        : team,
    );

    setBattleTeams(nextBattleTeams);
    setSavedPokemon((current) => applyBattleTeamMembership(current, nextBattleTeams));
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
    const resolvedTrainingBackRoute = trainingBackRoute?.view
      ? trainingBackRoute
      : editingPokemon
        ? { view: "trained" }
        : defaultTrainingBackRoute;
    const resolvedBackLabel =
      resolvedTrainingBackRoute.view === "teamDetail"
        ? "チーム詳細へ戻る"
        : resolvedTrainingBackRoute.view === "teamReorder"
          ? "入れ替え画面へ戻る"
        : editingPokemon
          ? "一覧へ戻る"
          : "ホームへ戻る";

    return (
      <TrainingStartView
        battleTeams={battleTeams}
        initialEntry={editingPokemon}
        backLabel={resolvedBackLabel}
        onBack={() => navigateTo(resolvedTrainingBackRoute)}
        onSave={handleSavePokemon}
      />
    );
  }

  if (activeView === "trained") {
    return (
      <TrainedPokemonView
        savedPokemon={savedPokemon}
        onBack={() => moveTo("home")}
        onEdit={(entryId) => openTrainingForEdit(entryId, { view: "trained" })}
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
        onReorderTeam={() =>
          viewingBattleTeamId ? openBattleTeamReorder(viewingBattleTeamId) : undefined
        }
        onEditPokemon={(entryId) =>
          openTrainingForEdit(entryId, {
            view: "teamDetail",
            viewingBattleTeamId: viewingBattleTeamId ?? null,
          })
        }
        onRemovePokemon={(entryId) =>
          viewingBattleTeamId ? handleRemovePokemonFromBattleTeam(viewingBattleTeamId, entryId) : undefined
        }
      />
    );
  }

  if (activeView === "teamReorder") {
    return (
      <BattleTeamReorderView
        team={viewingBattleTeam}
        savedPokemon={savedPokemon}
        onBack={() =>
          viewingBattleTeamId ? openBattleTeamDetail(viewingBattleTeamId) : navigateTo({ view: "teams" })
        }
        onCreatePokemon={() =>
          openTrainingForCreate({
            view: "teamReorder",
            viewingBattleTeamId: viewingBattleTeamId ?? null,
          })
        }
        onReorderTeam={handleReorderBattleTeam}
      />
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero__main">
          <p className="hero__eyebrow">Battle Team Management for Pokemon Champions</p>
          <p className="hero__copy">
            最終更新日：2026/3/31
            <br />
            未実装：新メガシンカポケモンの追加・PPの変更・新仕様の能力ランク
          </p>
        </div>
      </section>

      <section className="home-grid">
        {homeCards.map((card) => (
          <button
            key={card.id}
            className={`home-card home-card--${card.tone}`}
            type="button"
            onClick={() => (card.id === "training" ? openTrainingForCreate() : moveTo(card.id))}
          >
            <strong className="home-card__title">{card.title}</strong>
          </button>
        ))}
      </section>
    </main>
  );
}
