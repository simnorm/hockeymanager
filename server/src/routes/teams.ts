import express, { Request, Response } from 'express';
import { allAsync, runAsync } from '../database.js';
import { TeamWithPlayer } from '../types.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Create teams for a game (admin only)
router.post('/:gameId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { teams } = req.body; // teams: { team1: [playerId1, playerId2], team2: [...] }

    if (!teams || !teams.team1 || !teams.team2) {
      return res.status(400).json({ error: 'Both teams must be provided' });
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
      WHERE t.game_id = ?
      ORDER BY t.team_number, p.name
    `, [gameId]) as TeamWithPlayer[];

    res.json(createdTeams);
  } catch (error) {
    console.error('Create teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Auto-balance teams (admin only)
router.post('/:gameId/auto-balance', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // Get all players who are present
    const presentPlayers = await allAsync(`
      SELECT p.id, p.name
      FROM players p
      JOIN attendance a ON p.id = a.player_id
      WHERE a.game_id = ? AND a.status = 'present'
      ORDER BY RANDOM()
    `, [gameId]) as { id: number; name: string }[];

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
      WHERE t.game_id = ?
      ORDER BY t.team_number, p.name
    `, [gameId]) as TeamWithPlayer[];

    res.json(createdTeams);
  } catch (error) {
    console.error('Auto-balance teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
