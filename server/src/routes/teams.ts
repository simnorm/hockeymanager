import express, { Response } from 'express';
import { allAsync, getAsync, runAsync } from '../database.js';
import { TeamWithPlayer } from '../types.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

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

    const game = await getAsync('SELECT id FROM games WHERE id = ? AND league_id = ?', [
      gameId,
      req.leagueId,
    ]) as { id: number } | undefined;

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const allPlayerIds = [...teams.team1, ...teams.team2].map((id: unknown) => Number(id));
    const uniquePlayerIds = [...new Set(allPlayerIds)];

    if (uniquePlayerIds.length !== allPlayerIds.length) {
      return res.status(400).json({ error: 'A player cannot be on both teams' });
    }

    if (uniquePlayerIds.length > 0) {
      const placeholders = uniquePlayerIds.map(() => '?').join(', ');
      const playersInLeague = await allAsync(
        `SELECT id FROM players WHERE league_id = ? AND id IN (${placeholders})`,
        [req.leagueId, ...uniquePlayerIds]
      ) as { id: number }[];

      if (playersInLeague.length !== uniquePlayerIds.length) {
        return res.status(400).json({ error: 'One or more players are not in this league' });
      }
    }

    // Delete existing teams for this game
    await runAsync('DELETE FROM teams WHERE game_id = ?', [gameId]);

    // Insert new teams
    for (const playerId of teams.team1) {
      await runAsync('INSERT INTO teams (game_id, team_number, player_id) VALUES (?, ?, ?)', [gameId, 1, playerId]);
    }

    for (const playerId of teams.team2) {
      await runAsync('INSERT INTO teams (game_id, team_number, player_id) VALUES (?, ?, ?)', [gameId, 2, playerId]);
    }

    // Get created teams
    const createdTeams = await allAsync(`
      SELECT t.team_number, t.player_id, p.name as player_name
      FROM teams t
      JOIN players p ON t.player_id = p.id
      WHERE t.game_id = ? AND p.league_id = ?
      ORDER BY t.team_number, p.name
    `, [gameId, req.leagueId]) as TeamWithPlayer[];

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

    const game = await getAsync('SELECT id FROM games WHERE id = ? AND league_id = ?', [
      gameId,
      req.leagueId,
    ]) as { id: number } | undefined;

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get all players who are present
    const presentPlayers = await allAsync(`
      SELECT p.id, p.name
      FROM players p
      JOIN attendance a ON p.id = a.player_id
      WHERE a.game_id = ? AND a.status = 'present' AND p.league_id = ?
      ORDER BY RANDOM()
    `, [gameId, req.leagueId]) as { id: number; name: string }[];

    if (presentPlayers.length < 2) {
      return res.status(400).json({ error: 'Not enough players confirmed' });
    }

    // Delete existing teams
    await runAsync('DELETE FROM teams WHERE game_id = ?', [gameId]);

    // Distribute players evenly
    for (let i = 0; i < presentPlayers.length; i++) {
      const teamNumber = (i % 2) + 1;
      await runAsync('INSERT INTO teams (game_id, team_number, player_id) VALUES (?, ?, ?)', [gameId, teamNumber, presentPlayers[i].id]);
    }

    // Get created teams
    const createdTeams = await allAsync(`
      SELECT t.team_number, t.player_id, p.name as player_name
      FROM teams t
      JOIN players p ON t.player_id = p.id
      WHERE t.game_id = ? AND p.league_id = ?
      ORDER BY t.team_number, p.name
    `, [gameId, req.leagueId]) as TeamWithPlayer[];

    res.json(createdTeams);
  } catch (error) {
    console.error('Auto-balance teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
