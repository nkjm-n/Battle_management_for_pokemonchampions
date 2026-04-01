export const MAX_BATTLE_TEAM_SIZE = 6;
export const NEW_BATTLE_TEAM_OPTION = "__new_battle_team__";

export function normalizeBattleTeamName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\s\u3000]+/g, " ")
    .trim();
}

export function normalizeBattleTeam(team) {
  return {
    ...team,
    pokemonIds: Array.isArray(team?.pokemonIds)
      ? team.pokemonIds.filter((pokemonId) => typeof pokemonId === "string" && pokemonId)
      : [],
  };
}

export function normalizeBattleTeams(teams) {
  return Array.isArray(teams) ? teams.map(normalizeBattleTeam) : [];
}

export function findBattleTeamById(teams, teamId) {
  if (!teamId) {
    return null;
  }

  return normalizeBattleTeams(teams).find((team) => team.id === teamId) ?? null;
}

export function findBattleTeamByName(teams, teamName) {
  const normalizedTeamName = normalizeBattleTeamName(teamName);
  if (!normalizedTeamName) {
    return null;
  }

  return (
    normalizeBattleTeams(teams).find(
      (team) => normalizeBattleTeamName(team.name) === normalizedTeamName,
    ) ?? null
  );
}

export function findAssignedBattleTeamIds(teams, entry) {
  if (!entry?.id) {
    return [];
  }

  const normalizedTeams = normalizeBattleTeams(teams);
  const normalizedEntryTeamIds = Array.isArray(entry.battleTeamIds)
    ? entry.battleTeamIds.filter(
        (teamId, index, teamIds) =>
          typeof teamId === "string" &&
          teamId &&
          teamIds.indexOf(teamId) === index &&
          normalizedTeams.some((team) => team.id === teamId),
      )
    : [];

  if (normalizedEntryTeamIds.length > 0) {
    return normalizedEntryTeamIds;
  }

  if (entry.battleTeamId && normalizedTeams.some((team) => team.id === entry.battleTeamId)) {
    return [entry.battleTeamId];
  }

  return normalizedTeams
    .filter((team) => team.pokemonIds.includes(entry.id))
    .map((team) => team.id);
}

export function findAssignedBattleTeamId(teams, entry) {
  return findAssignedBattleTeamIds(teams, entry)[0] ?? null;
}

export function getBattleTeamIdsByPokemonId(teams, pokemonId) {
  if (!pokemonId) {
    return [];
  }

  return normalizeBattleTeams(teams)
    .filter((team) => team.pokemonIds.includes(pokemonId))
    .map((team) => team.id);
}

export function getBattleTeamNamesByIds(teams, teamIds) {
  if (!Array.isArray(teamIds) || teamIds.length === 0) {
    return [];
  }

  const normalizedTeams = normalizeBattleTeams(teams);
  return teamIds
    .map((teamId) => normalizedTeams.find((team) => team.id === teamId)?.name ?? "")
    .filter(Boolean);
}

export function createBattleTeamId() {
  return `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
