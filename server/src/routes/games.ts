import express, { Response } from 'express';
import { allAsync, getAsync, runAsync } from '../database.js';
import { Game, GameWithDetails, AttendanceWithPlayer, TeamWithPlayer } from '../types.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all games
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const games = await allAsync(
      'SELECT * FROM games WHERE league_id = ? ORDER BY date DESC, time DESC',
      [req.leagueId]
    ) as Game[];
    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get game by ID with details
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const game = await getAsync('SELECT * FROM games WHERE id = ? AND league_id = ?', [
      req.params.id,
      req.leagueId,
    ]) as Game;

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get attendance
    const attendance = await allAsync(`
      SELECT a.*, p.name as player_name, p.is_regular
      FROM attendance a
      JOIN players p ON a.player_id = p.id
      WHERE a.game_id = ? AND p.league_id = ?
      ORDER BY p.is_regular DESC, p.name
    `, [game.id, req.leagueId]) as AttendanceWithPlayer[];

    // Get teams
    const teams = await allAsync(`
      SELECT t.team_number, t.player_id, p.name as player_name
      FROM teams t
      JOIN players p ON t.player_id = p.id
      WHERE t.game_id = ? AND p.league_id = ?
      ORDER BY t.team_number, p.name
    `, [game.id, req.leagueId]) as TeamWithPlayer[];

    const gameWithDetails: GameWithDetails = {
      ...game,
      attendance,
      teams,
    };

    res.json(gameWithDetails);
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create game (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const { date, time, location } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const result = await runAsync(
      'INSERT INTO games (league_id, date, time, location) VALUES (?, ?, ?, ?)',
      [req.leagueId, date, time || null, location || null]
    );

    // Create attendance records for all active players
    const players = await allAsync(
      'SELECT id FROM players WHERE league_id = ? AND is_active = 1',
      [req.leagueId]
    ) as { id: number }[];

    for (const player of players) {
      await runAsync(
        'INSERT INTO attendance (game_id, player_id, status) VALUES (?, ?, ?)',
        [result.lastID, player.id, 'pending']
      );
    }

    const game = await getAsync('SELECT * FROM games WHERE id = ?', [result.lastID]) as Game;
    res.status(201).json(game);
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update game (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const { date, time, location, status, team1_score, team2_score } = req.body;

    await runAsync(
      'UPDATE games SET date = ?, time = ?, location = ?, status = ?, team1_score = ?, team2_score = ? WHERE id = ? AND league_id = ?',
      [
        date,
        time || null,
        location || null,
        status,
        team1_score || null,
        team2_score || null,
        req.params.id,
        req.leagueId,
      ]
    );

    const game = await getAsync('SELECT * FROM games WHERE id = ? AND league_id = ?', [
      req.params.id,
      req.leagueId,
    ]) as Game;

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    console.error('Update game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete game (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    await runAsync('DELETE FROM games WHERE id = ? AND league_id = ?', [req.params.id, req.leagueId]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
