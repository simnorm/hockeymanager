import express, { Response } from 'express';
import { allAsync, getAsync, runAsync } from '../database.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { LeagueAccess } from '../types.js';

const router = express.Router();

// Get leagues visible to the current user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.isAdmin) {
      const leagues = await allAsync('SELECT id, name FROM leagues ORDER BY name') as LeagueAccess[];
      return res.json(leagues);
    }

    const leagues = await allAsync(
      `SELECT l.id, l.name
       FROM user_leagues ul
       JOIN leagues l ON l.id = ul.league_id
       WHERE ul.user_id = ?
       ORDER BY l.name`,
      [req.userId]
    ) as LeagueAccess[];

    return res.json(leagues);
  } catch (error) {
    console.error('Get leagues error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create league (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const rawName = String(req.body?.name || '').trim();

    if (!rawName) {
      return res.status(400).json({ error: 'League name is required' });
    }

    const existing = await getAsync('SELECT id FROM leagues WHERE LOWER(name) = LOWER(?)', [rawName]) as
      | { id: number }
      | undefined;

    if (existing) {
      return res.status(400).json({ error: 'League already exists' });
    }

    const result = await runAsync('INSERT INTO leagues (name) VALUES (?)', [rawName]);
    const league = await getAsync('SELECT id, name FROM leagues WHERE id = ?', [result.lastID]) as LeagueAccess;

    return res.status(201).json(league);
  } catch (error) {
    console.error('Create league error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Rename league (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const leagueId = Number(req.params.id);
    const rawName = String(req.body?.name || '').trim();

    if (!Number.isFinite(leagueId)) {
      return res.status(400).json({ error: 'Invalid league id' });
    }

    if (!rawName) {
      return res.status(400).json({ error: 'League name is required' });
    }

    const existing = await getAsync(
      'SELECT id FROM leagues WHERE LOWER(name) = LOWER(?) AND id != ?',
      [rawName, leagueId]
    ) as { id: number } | undefined;

    if (existing) {
      return res.status(400).json({ error: 'League already exists' });
    }

    const target = await getAsync('SELECT id FROM leagues WHERE id = ?', [leagueId]) as { id: number } | undefined;
    if (!target) {
      return res.status(404).json({ error: 'League not found' });
    }

    await runAsync('UPDATE leagues SET name = ? WHERE id = ?', [rawName, leagueId]);
    const league = await getAsync('SELECT id, name FROM leagues WHERE id = ?', [leagueId]) as LeagueAccess;

    return res.json(league);
  } catch (error) {
    console.error('Rename league error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
