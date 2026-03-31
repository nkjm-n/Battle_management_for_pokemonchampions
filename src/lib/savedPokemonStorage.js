const DB_NAME = "poke-champ-storage";
const DB_VERSION = 1;
const STORE_NAME = "app-state";
const SAVED_POKEMON_KEY = "saved-pokemon";
const LEGACY_LOCAL_STORAGE_KEY = "poke-champ-trained-pokemon";

let databasePromise = null;

function getIndexedDb() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.indexedDB ?? null;
}

function readLegacySavedPokemon() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function clearLegacySavedPokemon() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
  } catch {
    // Ignore localStorage cleanup failures and continue using IndexedDB.
  }
}

function openDatabase() {
  if (databasePromise) {
    return databasePromise;
  }

  const indexedDb = getIndexedDb();
  if (!indexedDb) {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });

  return databasePromise;
}

function readStoredValue(key) {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).get(key);

        request.onsuccess = () => resolve(request.result?.value ?? null);
        request.onerror = () => reject(request.error ?? new Error("Failed to read IndexedDB value."));
      }),
  );
}

function writeStoredValue(key, value) {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");

        transaction.oncomplete = () => resolve();
        transaction.onabort = () =>
          reject(transaction.error ?? new Error("Failed to write IndexedDB value."));
        transaction.onerror = () =>
          reject(transaction.error ?? new Error("Failed to write IndexedDB value."));

        transaction.objectStore(STORE_NAME).put({
          key,
          value,
          updatedAt: Date.now(),
        });
      }),
  );
}

export async function loadSavedPokemonFromStorage() {
  if (typeof window === "undefined") {
    return [];
  }

  const legacySavedPokemon = readLegacySavedPokemon();

  try {
    if (!getIndexedDb()) {
      return legacySavedPokemon;
    }

    const indexedDbValue = await readStoredValue(SAVED_POKEMON_KEY);
    if (Array.isArray(indexedDbValue)) {
      return indexedDbValue;
    }

    if (legacySavedPokemon.length > 0) {
      await writeStoredValue(SAVED_POKEMON_KEY, legacySavedPokemon);
      clearLegacySavedPokemon();
      return legacySavedPokemon;
    }

    return [];
  } catch {
    return legacySavedPokemon;
  }
}

export async function saveSavedPokemonToStorage(savedPokemon) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedValue = Array.isArray(savedPokemon) ? savedPokemon : [];

  try {
    if (!getIndexedDb()) {
      window.localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(normalizedValue));
      return;
    }

    await writeStoredValue(SAVED_POKEMON_KEY, normalizedValue);
    clearLegacySavedPokemon();
  } catch {
    window.localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(normalizedValue));
  }
}
