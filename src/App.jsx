import { startTransition, useEffect, useState } from "react";
import TrainingStartView from "./components/TrainingStartView";
import TrainedPokemonView from "./components/TrainedPokemonView";
import {
  loadSavedPokemonFromStorage,
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
    description: "チーム単位で育成済みポケモンを編成する画面。今回は入口だけ先に用意します。",
    status: "planned",
  },
];

function PlaceholderView({ title, onBack }) {
  return (
    <div className="view-shell">
      <header className="topbar">
        <button className="ghost-button" type="button" onClick={onBack}>
          ホームへ戻る
        </button>
      </header>
      <section className="panel panel--soft placeholder-panel">
        <p className="section-heading__eyebrow">Coming Next</p>
        <h1>{title}</h1>
        <p>この画面は次の実装対象です。今回は「育成開始」と「育成済みポケモン」までを先に動作させています。</p>
      </section>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState("home");
  const [savedPokemon, setSavedPokemon] = useState([]);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [editingPokemonId, setEditingPokemonId] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    loadSavedPokemonFromStorage()
      .then((loadedPokemon) => {
        if (isCancelled) {
          return;
        }

        setSavedPokemon(loadedPokemon);
        setIsStorageReady(true);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setSavedPokemon([]);
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

  function handleSavePokemon(entry) {
    setSavedPokemon((current) => {
      const existingEntryIndex = current.findIndex((savedEntry) => savedEntry.id === entry.id);

      if (existingEntryIndex === -1) {
        return [entry, ...current];
      }

      return current.map((savedEntry) => (savedEntry.id === entry.id ? entry : savedEntry));
    });
  }

  function handleDeletePokemon(entryId) {
    setSavedPokemon((current) => current.filter((entry) => entry.id !== entryId));
  }

  const editingPokemon =
    editingPokemonId == null
      ? null
      : savedPokemon.find((entry) => entry.id === editingPokemonId) ?? null;

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
    return <PlaceholderView title="バトルチーム" onBack={() => moveTo("home")} />;
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
