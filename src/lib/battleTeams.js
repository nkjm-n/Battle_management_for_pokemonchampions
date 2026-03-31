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

export function findAssignedBattleTeamId(teams, entry) {
  if (!entry?.id) {
    return null;
  }

  const normalizedTeams = normalizeBattleTeams(teams);

  if (entry.battleTeamId && normalizedTeams.some((team) => team.id === entry.battleTeamId)) {
    return entry.battleTeamId;
  }

  return normalizedTeams.find((team) => team.pokemonIds.includes(entry.id))?.id ?? null;
}

export function createBattleTeamId() {
  return `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
