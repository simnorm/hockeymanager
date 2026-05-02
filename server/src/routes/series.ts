import express, { Response } from 'express';
import { allAsync, getAsync, runAsync } from '../database.js';
import { Series } from '../types.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all series for current league
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const series = await allAsync(
      'SELECT * FROM series WHERE league_id = ? ORDER BY created_at DESC',
      [req.leagueId]
    ) as Series[];

    res.json(series);
  } catch (error) {
    console.error('Get series error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new series for the current league
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const { name, best_of } = req.body;
    const allowedBestOf = [1, 3, 5, 7];

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Series name is required' });
    }

    if (!allowedBestOf.includes(Number(best_of))) {
      return res.status(400).json({ error: 'Best of must be 1, 3, 5, or 7' });
    }

    const result = await runAsync(
      'INSERT INTO series (league_id, name, best_of, team1_wins, team2_wins) VALUES (?, ?, ?, 0, 0)',
      [req.leagueId, name.trim(), Number(best_of)]
    );

    const createdSeries = await getAsync('SELECT * FROM series WHERE id = ?', [result.lastID]) as Series;
    res.status(201).json(createdSeries);
  } catch (error) {
    console.error('Create series error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
