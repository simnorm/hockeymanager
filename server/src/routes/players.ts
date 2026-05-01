import express, { Response } from 'express';
import { allAsync, getAsync, runAsync } from '../database.js';
import { Player } from '../types.js';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

function normalizeRating(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 5;
  }

  const rounded = Math.round(parsed);
  return Math.max(0, Math.min(10, rounded));
}

// Get all players
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const players = await allAsync(
      'SELECT * FROM players WHERE league_id = ? AND is_active = 1 ORDER BY is_regular DESC, name',
      [req.leagueId]
    ) as Player[];
    res.json(players);
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get player by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const player = await getAsync('SELECT * FROM players WHERE id = ? AND league_id = ?', [
      req.params.id,
      req.leagueId,
    ]) as Player;

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(player);
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create player (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const { name, email, phone, is_regular, defense_rating, forward_rating, goalie_rating } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await runAsync(
      `INSERT INTO players
      (league_id, name, email, phone, is_regular, defense_rating, forward_rating, goalie_rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.leagueId,
        name,
        email || null,
        phone || null,
        is_regular ? 1 : 0,
        normalizeRating(defense_rating),
        normalizeRating(forward_rating),
        normalizeRating(goalie_rating),
      ]
    );

    const player = await getAsync('SELECT * FROM players WHERE id = ?', [result.lastID]) as Player;
    res.status(201).json(player);
  } catch (error) {
    console.error('Create player error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update player (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const { name, email, phone, is_regular, is_active, defense_rating, forward_rating, goalie_rating } = req.body;

    await runAsync(
      `UPDATE players
      SET name = ?, email = ?, phone = ?, is_regular = ?, is_active = ?, defense_rating = ?, forward_rating = ?, goalie_rating = ?
      WHERE id = ? AND league_id = ?`,
      [
        name,
        email || null,
        phone || null,
        is_regular ? 1 : 0,
        is_active ? 1 : 0,
        normalizeRating(defense_rating),
        normalizeRating(forward_rating),
        normalizeRating(goalie_rating),
        req.params.id,
        req.leagueId,
      ]
    );

    const player = await getAsync('SELECT * FROM players WHERE id = ? AND league_id = ?', [
      req.params.id,
      req.leagueId,
    ]) as Player;

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    console.error('Update player error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete player (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    await runAsync('DELETE FROM players WHERE id = ? AND league_id = ?', [req.params.id, req.leagueId]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete player error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
