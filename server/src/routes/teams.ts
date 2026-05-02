import express, { Response } from 'express';
import { allAsync, getAsync, runAsync } from '../database.js';
import { TeamWithPlayer } from '../types.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

interface RatedPlayer {
  id: number;
  name: string;
  position: 'forward' | 'defense' | 'goalie';
  offense_weight: number;
  defense_weight: number;
  defense_rating: number;
  forward_rating: number;
  goalie_rating: number;
}

interface TeamScore {
  players: number;
  defense: number;
  forward: number;
  goalie: number;
}

interface TeamRoleCount {
  forwards: number;
  defense: number;
  goalies: number;
}

function withPlayer(score: TeamScore, player: RatedPlayer): TeamScore {
  return {
    players: score.players + 1,
    defense: score.defense + player.defense_rating,
    forward: score.forward + player.forward_rating,
    goalie: score.goalie + player.goalie_rating,
  };
}

function balanceCost(team1: TeamScore, team2: TeamScore): number {
  return (
    Math.abs(team1.defense - team2.defense) +
    Math.abs(team1.forward - team2.forward) +
    Math.abs(team1.goalie - team2.goalie)
  );
}

const LINEUP = {
  forwardsPerTeam: 6,
  defensePerTeam: 4,
  goaliesPerTeam: 1,
};

function getRoleRating(player: RatedPlayer, role: 'forward' | 'defense' | 'goalie'): number {
  if (role === 'forward') {
    return player.forward_rating;
  }

  if (role === 'defense') {
    return player.defense_rating;
  }

  return player.goalie_rating;
}

function getRoleWeight(player: RatedPlayer, role: 'forward' | 'defense'): number {
  return role === 'forward' ? player.offense_weight : player.defense_weight;
}

function assignRolePlayers(
  rolePlayers: RatedPlayer[],
  role: 'forward' | 'defense' | 'goalie',
  basePerTeam: number,
  assignedTeam1: RatedPlayer[],
  assignedTeam2: RatedPlayer[],
  team1Score: TeamScore,
  team2Score: TeamScore,
  team1Roles: TeamRoleCount,
  team2Roles: TeamRoleCount
): void {
  const sortedByRole = [...rolePlayers].sort((a, b) => getRoleRating(b, role) - getRoleRating(a, role));
  const baseTotal = basePerTeam * 2;
  const starters = sortedByRole.slice(0, baseTotal);
  const extras = sortedByRole.slice(baseTotal);

  for (const player of starters) {
    const team1RoleCount = role === 'forward' ? team1Roles.forwards : role === 'defense' ? team1Roles.defense : team1Roles.goalies;
    const team2RoleCount = role === 'forward' ? team2Roles.forwards : role === 'defense' ? team2Roles.defense : team2Roles.goalies;

    let chooseTeam = 1;
    if (team1RoleCount >= basePerTeam) {
      chooseTeam = 2;
    } else if (team2RoleCount >= basePerTeam) {
      chooseTeam = 1;
    } else {
      const ratingDiffIfTeam1 = Math.abs(
        (role === 'forward' ? team1Score.forward : role === 'defense' ? team1Score.defense : team1Score.goalie) + getRoleRating(player, role) -
        (role === 'forward' ? team2Score.forward : role === 'defense' ? team2Score.defense : team2Score.goalie)
      );

      const ratingDiffIfTeam2 = Math.abs(
        (role === 'forward' ? team1Score.forward : role === 'defense' ? team1Score.defense : team1Score.goalie) -
        ((role === 'forward' ? team2Score.forward : role === 'defense' ? team2Score.defense : team2Score.goalie) + getRoleRating(player, role))
      );

      chooseTeam = ratingDiffIfTeam1 <= ratingDiffIfTeam2 ? 1 : 2;
    }

    if (chooseTeam === 1) {
      assignedTeam1.push(player);
      if (role === 'forward') team1Roles.forwards += 1;
      if (role === 'defense') team1Roles.defense += 1;
      if (role === 'goalie') team1Roles.goalies += 1;
      team1Score.players += 1;
      if (role === 'forward') team1Score.forward += player.forward_rating;
      if (role === 'defense') team1Score.defense += player.defense_rating;
      if (role === 'goalie') team1Score.goalie += player.goalie_rating;
    } else {
      assignedTeam2.push(player);
      if (role === 'forward') team2Roles.forwards += 1;
      if (role === 'defense') team2Roles.defense += 1;
      if (role === 'goalie') team2Roles.goalies += 1;
      team2Score.players += 1;
      if (role === 'forward') team2Score.forward += player.forward_rating;
      if (role === 'defense') team2Score.defense += player.defense_rating;
      if (role === 'goalie') team2Score.goalie += player.goalie_rating;
    }
  }

  for (const player of extras) {
    const team1Candidate = withPlayer(team1Score, player);
    const team2Candidate = withPlayer(team2Score, player);

    const team1Cost = balanceCost(team1Candidate, team2Score);
    const team2Cost = balanceCost(team1Score, team2Candidate);

    let chooseTeam = 1;
    if (team1Score.players > team2Score.players) {
      chooseTeam = 2;
    } else if (team2Score.players > team1Score.players) {
      chooseTeam = 1;
    } else {
      chooseTeam = team1Cost <= team2Cost ? 1 : 2;
    }

    if (chooseTeam === 1) {
      assignedTeam1.push(player);
      team1Score.players += 1;
      if (role === 'forward') {
        team1Roles.forwards += 1;
        team1Score.forward += player.forward_rating;
      }
      if (role === 'defense') {
        team1Roles.defense += 1;
        team1Score.defense += player.defense_rating;
      }
      if (role === 'goalie') {
        team1Roles.goalies += 1;
        team1Score.goalie += player.goalie_rating;
      }
    } else {
      assignedTeam2.push(player);
      team2Score.players += 1;
      if (role === 'forward') {
        team2Roles.forwards += 1;
        team2Score.forward += player.forward_rating;
      }
      if (role === 'defense') {
        team2Roles.defense += 1;
        team2Score.defense += player.defense_rating;
      }
      if (role === 'goalie') {
        team2Roles.goalies += 1;
        team2Score.goalie += player.goalie_rating;
      }
    }
  }
}

// Create teams for a game (admin only)
router.post('/:gameId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const { gameId } = req.params;
    const { teams } = req.body; // teams: { team1: [playerId1, playerId2], team2: [...] }

    if (!teams || !teams.team1 || !teams.team2) {
      return res.status(400).json({ error: 'Both teams must be provided' });
    }

    const game = await getAsync('SELECT id, series_id FROM games WHERE id = ? AND league_id = ?', [
      gameId,
      req.leagueId,
    ]) as { id: number; series_id?: number } | undefined;

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const targetColumn = game.series_id ? 'series_id' : 'game_id';
    const targetValue = game.series_id || game.id;

    const allPlayerIds = [...teams.team1, ...teams.team2].map((id: unknown) => Number(id));
    const uniquePlayerIds = [...new Set(allPlayerIds)];

    if (uniquePlayerIds.length !== allPlayerIds.length) {
      return res.status(400).json({ error: 'A player cannot be on both teams' });
    }

    if (uniquePlayerIds.length > 0) {
      const placeholders = uniquePlayerIds.map(() => '?').join(', ');
      const playersInLeague = await allAsync(
        `SELECT p.id
         FROM players p
         JOIN player_leagues pl ON pl.player_id = p.id
         WHERE pl.league_id = ? AND p.id IN (${placeholders})`,
        [req.leagueId, ...uniquePlayerIds]
      ) as { id: number }[];

      if (playersInLeague.length !== uniquePlayerIds.length) {
        return res.status(400).json({ error: 'One or more players are not in this league' });
      }
    }

    // Delete existing teams for this series or game
    await runAsync(`DELETE FROM teams WHERE ${targetColumn} = ?`, [targetValue]);

    const insertColumn = game.series_id ? 'series_id' : 'game_id';

    // Insert new teams
    for (const playerId of teams.team1) {
      await runAsync(
        `INSERT INTO teams (${insertColumn}, team_number, player_id) VALUES (?, ?, ?)`,
        [targetValue, 1, playerId]
      );
    }

    for (const playerId of teams.team2) {
      await runAsync(
        `INSERT INTO teams (${insertColumn}, team_number, player_id) VALUES (?, ?, ?)`,
        [targetValue, 2, playerId]
      );
    }

    // Get created teams
    const createdTeams = await allAsync(`
      SELECT t.team_number, t.player_id, p.name as player_name, p.position, t.team_name
      FROM teams t
      JOIN players p ON t.player_id = p.id
      JOIN player_leagues pl ON pl.player_id = p.id
      WHERE t.${targetColumn} = ? AND pl.league_id = ?
      ORDER BY t.team_number, p.name
    `, [targetValue, req.leagueId]) as TeamWithPlayer[];

    res.json(createdTeams);
  } catch (error) {
    console.error('Create teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Auto-balance teams (admin only)
router.post('/:gameId/auto-balance', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const { gameId } = req.params;

    const game = await getAsync('SELECT id, series_id FROM games WHERE id = ? AND league_id = ?', [
      gameId,
      req.leagueId,
    ]) as { id: number; series_id?: number } | undefined;

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const targetColumn = game.series_id ? 'series_id' : 'game_id';
    const targetValue = game.series_id || game.id;

    // Build planning teams from active regulars, independent of attendance confirmations.
    const presentPlayers = await allAsync(`
      SELECT p.id, p.name, p.position, p.offense_weight, p.defense_weight, p.defense_rating, p.forward_rating, p.goalie_rating
      FROM players p
      JOIN player_leagues pl ON pl.player_id = p.id
      WHERE pl.league_id = ? AND p.is_active = 1 AND p.is_regular = 1
    `, [req.leagueId]) as RatedPlayer[];

    if (presentPlayers.length < 2) {
      return res.status(400).json({ error: 'Not enough regular players available' });
    }

    const skaters = presentPlayers.filter((p) => p.position !== 'goalie');
    const goalies = presentPlayers.filter((p) => p.position === 'goalie');

    const offenseOnly = skaters.filter((p) => p.offense_weight > 0 && p.defense_weight === 0);
    const defenseOnly = skaters.filter((p) => p.defense_weight > 0 && p.offense_weight === 0);
    const flexibleSkaters = skaters.filter((p) => p.offense_weight > 0 && p.defense_weight > 0);

    const minimumForwards = LINEUP.forwardsPerTeam * 2;
    const minimumDefense = LINEUP.defensePerTeam * 2;
    const minimumGoalies = LINEUP.goaliesPerTeam * 2;

    const minimumSkaters = minimumForwards + minimumDefense;
    if (skaters.length < minimumSkaters) {
      return res.status(400).json({
        error: `Not enough skaters for lineup requirements. Need ${minimumSkaters}, got ${skaters.length}.`,
      });
    }

    if (goalies.length < minimumGoalies) {
      return res.status(400).json({
        error: `Not enough goalies for lineup requirements. Need ${minimumGoalies}, got ${goalies.length}.`,
      });
    }

    if (offenseOnly.length > minimumForwards) {
      return res.status(400).json({
        error: `Too many offense-only players for this lineup. Max ${minimumForwards}, got ${offenseOnly.length}.`,
      });
    }

    if (defenseOnly.length > minimumDefense) {
      return res.status(400).json({
        error: `Too many defense-only players for this lineup. Max ${minimumDefense}, got ${defenseOnly.length}.`,
      });
    }

    const requiredFlexibleForwards = minimumForwards - offenseOnly.length;
    const requiredFlexibleDefense = minimumDefense - defenseOnly.length;

    if (flexibleSkaters.length < requiredFlexibleForwards + requiredFlexibleDefense) {
      return res.status(400).json({
        error: 'Not enough flexible skaters to satisfy offense/defense lineup weights.',
      });
    }

    const sortedFlexibleForwards = [...flexibleSkaters].sort((a, b) => {
      const scoreA = getRoleWeight(a, 'forward') * 2 + a.forward_rating;
      const scoreB = getRoleWeight(b, 'forward') * 2 + b.forward_rating;
      return scoreB - scoreA;
    });

    const offenseFromFlexible = sortedFlexibleForwards.slice(0, requiredFlexibleForwards);
    const offenseIds = new Set(offenseFromFlexible.map((p) => p.id));
    const remainingFlexible = sortedFlexibleForwards.filter((p) => !offenseIds.has(p.id));

    const sortedFlexibleDefense = [...remainingFlexible].sort((a, b) => {
      const scoreA = getRoleWeight(a, 'defense') * 2 + a.defense_rating;
      const scoreB = getRoleWeight(b, 'defense') * 2 + b.defense_rating;
      return scoreB - scoreA;
    });

    const defenseFromFlexible = sortedFlexibleDefense.slice(0, requiredFlexibleDefense);
    const selectedDefenseIds = new Set(defenseFromFlexible.map((p) => p.id));
    const extraFlexible = sortedFlexibleDefense.filter((p) => !selectedDefenseIds.has(p.id));

    const forwards = [...offenseOnly, ...offenseFromFlexible];
    const defense = [...defenseOnly, ...defenseFromFlexible];

    for (const player of extraFlexible) {
      const forwardScore = getRoleWeight(player, 'forward') * 2 + player.forward_rating;
      const defenseScore = getRoleWeight(player, 'defense') * 2 + player.defense_rating;
      if (forwardScore >= defenseScore) {
        forwards.push(player);
      } else {
        defense.push(player);
      }
    }

    // Delete existing teams for this series or game
    await runAsync(`DELETE FROM teams WHERE ${targetColumn} = ?`, [targetValue]);

    const assignedTeam1: RatedPlayer[] = [];
    const assignedTeam2: RatedPlayer[] = [];

    const team1Score: TeamScore = { players: 0, defense: 0, forward: 0, goalie: 0 };
    const team2Score: TeamScore = { players: 0, defense: 0, forward: 0, goalie: 0 };
    const team1Roles: TeamRoleCount = { forwards: 0, defense: 0, goalies: 0 };
    const team2Roles: TeamRoleCount = { forwards: 0, defense: 0, goalies: 0 };

    assignRolePlayers(
      goalies,
      'goalie',
      LINEUP.goaliesPerTeam,
      assignedTeam1,
      assignedTeam2,
      team1Score,
      team2Score,
      team1Roles,
      team2Roles
    );

    assignRolePlayers(
      defense,
      'defense',
      LINEUP.defensePerTeam,
      assignedTeam1,
      assignedTeam2,
      team1Score,
      team2Score,
      team1Roles,
      team2Roles
    );

    assignRolePlayers(
      forwards,
      'forward',
      LINEUP.forwardsPerTeam,
      assignedTeam1,
      assignedTeam2,
      team1Score,
      team2Score,
      team1Roles,
      team2Roles
    );

    const insertColumn = game.series_id ? 'series_id' : 'game_id';
    for (const player of assignedTeam1) {
      await runAsync(`INSERT INTO teams (${insertColumn}, team_number, player_id) VALUES (?, ?, ?)`, [targetValue, 1, player.id]);
    }

    for (const player of assignedTeam2) {
      await runAsync(`INSERT INTO teams (${insertColumn}, team_number, player_id) VALUES (?, ?, ?)`, [targetValue, 2, player.id]);
    }

    // Get created teams
    const createdTeams = await allAsync(`
      SELECT t.team_number, t.player_id, p.name as player_name, p.position, t.team_name
      FROM teams t
      JOIN players p ON t.player_id = p.id
      JOIN player_leagues pl ON pl.player_id = p.id
      WHERE t.${targetColumn} = ? AND pl.league_id = ?
      ORDER BY t.team_number, p.name
    `, [targetValue, req.leagueId]) as TeamWithPlayer[];

    res.json(createdTeams);
  } catch (error) {
    console.error('Auto-balance teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update team names (admin only)
router.put('/:gameId/team-names', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const { gameId } = req.params;
    const { team1Name, team2Name } = req.body;

    const game = await getAsync('SELECT id, series_id FROM games WHERE id = ? AND league_id = ?', [
      gameId,
      req.leagueId,
    ]) as { id: number; series_id?: number } | undefined;

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const targetColumn = game.series_id ? 'series_id' : 'game_id';
    const targetValue = game.series_id || game.id;

    // Update team names
    if (team1Name) {
      await runAsync(`UPDATE teams SET team_name = ? WHERE ${targetColumn} = ? AND team_number = 1`, [team1Name, targetValue]);
    }
    if (team2Name) {
      await runAsync(`UPDATE teams SET team_name = ? WHERE ${targetColumn} = ? AND team_number = 2`, [team2Name, targetValue]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update team names error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
