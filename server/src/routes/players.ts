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

function normalizeWeight(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 5;
  }

  const rounded = Math.round(parsed);
  return Math.max(0, Math.min(10, rounded));
}

function normalizePosition(value: unknown): 'forward' | 'defense' | 'goalie' {
  if (value === 'defense' || value === 'goalie') {
    return value;
  }

  return 'forward';
}

// Get all players
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const players = await allAsync(
      `SELECT 
        p.*,
        COALESCE(plr.position, p.position) as effective_position,
        COALESCE(plr.offense_weight, p.offense_weight) as effective_offense_weight,
        COALESCE(plr.defense_weight, p.defense_weight) as effective_defense_weight,
        COALESCE(plr.defense_rating, p.defense_rating) as effective_defense_rating,
        COALESCE(plr.forward_rating, p.forward_rating) as effective_forward_rating,
        COALESCE(plr.goalie_rating, p.goalie_rating) as effective_goalie_rating
       FROM players p
       JOIN player_leagues pl ON pl.player_id = p.id
       LEFT JOIN player_league_ratings plr ON plr.player_id = p.id AND plr.league_id = pl.league_id
       WHERE pl.league_id = ? AND p.is_active = 1
       ORDER BY p.is_regular DESC, p.name`,
      [req.leagueId]
    ) as (Player & {
      effective_position: string;
      effective_offense_weight: number;
      effective_defense_weight: number;
      effective_defense_rating: number;
      effective_forward_rating: number;
      effective_goalie_rating: number;
    })[];

    // Transform the results to use effective ratings
    const transformedPlayers = players.map(player => ({
      ...player,
      position: player.effective_position,
      offense_weight: player.effective_offense_weight,
      defense_weight: player.effective_defense_weight,
      defense_rating: player.effective_defense_rating,
      forward_rating: player.effective_forward_rating,
      goalie_rating: player.effective_goalie_rating,
    }));

    res.json(transformedPlayers);
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Find players that can be added to the current league (admin only)
router.get('/available-to-add', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const rawQuery = String(req.query.q || '').trim();
    const likeQuery = `%${rawQuery.toLowerCase()}%`;

    const players = await allAsync(
      `SELECT p.*
       FROM players p
       WHERE p.is_active = 1
         AND p.id NOT IN (
           SELECT pl.player_id FROM player_leagues pl WHERE pl.league_id = ?
         )
         AND (
           ? = ''
           OR LOWER(p.name) LIKE ?
           OR LOWER(COALESCE(p.email, '')) LIKE ?
         )
       ORDER BY p.name
       LIMIT 25`,
      [req.leagueId, rawQuery, likeQuery, likeQuery]
    ) as Player[];

    return res.json(players);
  } catch (error) {
    console.error('Get available players error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Add an existing player to the current league (admin only)
router.post('/:id/add-to-current-league', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const playerId = Number(req.params.id);
    if (!Number.isFinite(playerId)) {
      return res.status(400).json({ error: 'Invalid player id' });
    }

    const player = await getAsync('SELECT * FROM players WHERE id = ? AND is_active = 1', [playerId]) as Player | undefined;
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const existingMembership = await getAsync(
      'SELECT id FROM player_leagues WHERE player_id = ? AND league_id = ?',
      [playerId, req.leagueId]
    ) as { id: number } | undefined;

    if (existingMembership) {
      return res.status(400).json({ error: 'Player already in this league' });
    }

    await runAsync('INSERT INTO player_leagues (player_id, league_id) VALUES (?, ?)', [playerId, req.leagueId]);

    return res.status(201).json(player);
  } catch (error) {
    console.error('Add existing player to league error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get player league count
router.get('/:id/league-count', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = Number(req.params.id);
    if (!Number.isFinite(playerId)) {
      return res.status(400).json({ error: 'Invalid player id' });
    }

    const result = await getAsync(
      'SELECT COUNT(*) as leagueCount FROM player_leagues WHERE player_id = ?',
      [playerId]
    ) as { leagueCount: number };

    res.json({ leagueCount: result.leagueCount });
  } catch (error) {
    console.error('Get player league count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create player (admin only)
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.leagueId) {
      return res.status(403).json({ error: 'League context required' });
    }

    const {
      name,
      email,
      phone,
      is_regular,
      position,
      offense_weight,
      defense_weight,
      defense_rating,
      forward_rating,
      goalie_rating,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // If the same email already exists, attach that player to this league.
    if (email) {
      const existingByEmail = await getAsync(
        'SELECT * FROM players WHERE LOWER(email) = LOWER(?)',
        [email]
      ) as Player | undefined;

      if (existingByEmail) {
        const alreadyInLeague = await getAsync(
          'SELECT id FROM player_leagues WHERE player_id = ? AND league_id = ?',
          [existingByEmail.id, req.leagueId]
        ) as { id: number } | undefined;

        if (alreadyInLeague) {
          return res.status(400).json({ error: 'Player already exists in this league' });
        }

        await runAsync('INSERT INTO player_leagues (player_id, league_id) VALUES (?, ?)', [
          existingByEmail.id,
          req.leagueId,
        ]);

        return res.status(201).json(existingByEmail);
      }
    }

    const result = await runAsync(
      `INSERT INTO players
      (league_id, name, position, email, phone, is_regular, offense_weight, defense_weight, defense_rating, forward_rating, goalie_rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.leagueId,
        name,
        normalizePosition(position),
        email || null,
        phone || null,
        is_regular ? 1 : 0,
        normalizeWeight(offense_weight),
        normalizeWeight(defense_weight),
        normalizeRating(defense_rating),
        normalizeRating(forward_rating),
        normalizeRating(goalie_rating),
      ]
    );

    await runAsync('INSERT INTO player_leagues (player_id, league_id) VALUES (?, ?)', [
      result.lastID,
      req.leagueId,
    ]);

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

    const {
      name,
      email,
      phone,
      is_regular,
      is_active,
      position,
      offense_weight,
      defense_weight,
      defense_rating,
      forward_rating,
      goalie_rating,
      updateScope, // 'league' or 'global'
    } = req.body;

    const playerId = Number(req.params.id);

    // Check if player exists in this league
    const leagueMembership = await getAsync(
      'SELECT id FROM player_leagues WHERE player_id = ? AND league_id = ?',
      [playerId, req.leagueId]
    );

    if (!leagueMembership) {
      return res.status(404).json({ error: 'Player not found in this league' });
    }

    if (updateScope === 'league') {
      // Update or insert league-specific ratings
      await runAsync(
        `INSERT OR REPLACE INTO player_league_ratings
         (player_id, league_id, position, offense_weight, defense_weight, defense_rating, forward_rating, goalie_rating, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          playerId,
          req.leagueId,
          normalizePosition(position),
          normalizeWeight(offense_weight),
          normalizeWeight(defense_weight),
          normalizeRating(defense_rating),
          normalizeRating(forward_rating),
          normalizeRating(goalie_rating),
        ]
      );
    } else {
      // Update global player data
      await runAsync(
        `UPDATE players
        SET name = ?, position = ?, email = ?, phone = ?, is_regular = ?, is_active = ?, offense_weight = ?, defense_weight = ?, defense_rating = ?, forward_rating = ?, goalie_rating = ?
        WHERE id = ?`,
        [
          name,
          normalizePosition(position),
          email || null,
          phone || null,
          is_regular ? 1 : 0,
          is_active ? 1 : 0,
          normalizeWeight(offense_weight),
          normalizeWeight(defense_weight),
          normalizeRating(defense_rating),
          normalizeRating(forward_rating),
          normalizeRating(goalie_rating),
          playerId,
        ]
      );

      // If updating globally, remove any league-specific overrides for this league
      await runAsync(
        'DELETE FROM player_league_ratings WHERE player_id = ? AND league_id = ?',
        [playerId, req.leagueId]
      );
    }

    // Return the updated player data
    const player = await getAsync(
      `SELECT 
        p.*,
        COALESCE(plr.position, p.position) as effective_position,
        COALESCE(plr.offense_weight, p.offense_weight) as effective_offense_weight,
        COALESCE(plr.defense_weight, p.defense_weight) as effective_defense_weight,
        COALESCE(plr.defense_rating, p.defense_rating) as effective_defense_rating,
        COALESCE(plr.forward_rating, p.forward_rating) as effective_forward_rating,
        COALESCE(plr.goalie_rating, p.goalie_rating) as effective_goalie_rating
       FROM players p
       LEFT JOIN player_league_ratings plr ON plr.player_id = p.id AND plr.league_id = ?
       WHERE p.id = ?`,
      [req.leagueId, playerId]
    ) as (Player & {
      effective_position: string;
      effective_offense_weight: number;
      effective_defense_weight: number;
      effective_defense_rating: number;
      effective_forward_rating: number;
      effective_goalie_rating: number;
    }) | undefined;

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Transform the result to use effective ratings
    const transformedPlayer = {
      ...player,
      position: player.effective_position,
      offense_weight: player.effective_offense_weight,
      defense_weight: player.effective_defense_weight,
      defense_rating: player.effective_defense_rating,
      forward_rating: player.effective_forward_rating,
      goalie_rating: player.effective_goalie_rating,
    };

    res.json(transformedPlayer);
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

    // Remove player from this league only; keep shared player if linked to other leagues.
    await runAsync(
      `DELETE FROM attendance
       WHERE player_id = ?
         AND game_id IN (SELECT id FROM games WHERE league_id = ?)`,
      [req.params.id, req.leagueId]
    );
    await runAsync(
      `DELETE FROM teams
       WHERE player_id = ?
         AND game_id IN (SELECT id FROM games WHERE league_id = ?)`,
      [req.params.id, req.leagueId]
    );
    await runAsync('DELETE FROM player_leagues WHERE player_id = ? AND league_id = ?', [
      req.params.id,
      req.leagueId,
    ]);

    // If no league links remain, delete the player row.
    const remainingLinks = await getAsync('SELECT id FROM player_leagues WHERE player_id = ? LIMIT 1', [
      req.params.id,
    ]) as { id: number } | undefined;

    if (!remainingLinks) {
      await runAsync('DELETE FROM players WHERE id = ?', [req.params.id]);
    }
    res.status(204).send();
  } catch (error) {
    console.error('Delete player error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
