import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { allAsync, getAsync, runAsync } from '../database.js';
import { User, LeagueAccess } from '../types.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

async function getAccessibleLeagues(userId: number, isAdmin: boolean): Promise<LeagueAccess[]> {
  if (isAdmin) {
    return await allAsync('SELECT id, name FROM leagues ORDER BY name') as LeagueAccess[];
  }

  return await allAsync(
    `SELECT l.id, l.name
     FROM user_leagues ul
     JOIN leagues l ON l.id = ul.league_id
     WHERE ul.user_id = ?
     ORDER BY l.name`,
    [userId]
  ) as LeagueAccess[];
}

function signToken(userId: number, isAdmin: boolean, leagueId: number): string {
  return jwt.sign(
    { userId, isAdmin, leagueId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
}

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await getAsync('SELECT * FROM users WHERE username = ?', [username]) as User;

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isAdmin = user.is_admin === 1;
    const leagues = await getAccessibleLeagues(user.id, isAdmin);

    if (leagues.length === 0) {
      return res.status(403).json({ error: 'No leagues assigned to this user' });
    }

    const activeLeagueId = leagues.some((league) => league.id === user.league_id)
      ? user.league_id
      : leagues[0].id;

    const token = signToken(user.id, isAdmin, activeLeagueId);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        isAdmin,
        leagueId: activeLeagueId,
        leagues,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register (for creating player accounts)
router.post('/register', async (req, res) => {
  try {
    const { username, password, playerId, leagueId } = req.body;

    // Check if username exists
    const existing = await getAsync('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const defaultLeague = await getAsync('SELECT id FROM leagues ORDER BY id LIMIT 1') as { id: number } | undefined;

    let resolvedLeagueId: number | undefined;

    if (playerId) {
      const player = await getAsync(
        `SELECT p.id, pl.league_id, p.user_id
         FROM players p
         JOIN player_leagues pl ON pl.player_id = p.id
         WHERE p.id = ? AND p.is_active = 1
         ORDER BY pl.id ASC
         LIMIT 1`,
        [playerId]
      ) as { id: number; league_id: number; user_id: number | null } | undefined;

      if (!player) {
        return res.status(400).json({ error: 'Player not found' });
      }

      if (player.user_id) {
        return res.status(400).json({ error: 'Player already has an account' });
      }

      resolvedLeagueId = player.league_id;
    } else if (leagueId) {
      const existingLeague = await getAsync('SELECT id FROM leagues WHERE id = ?', [leagueId]) as { id: number } | undefined;
      if (!existingLeague) {
        return res.status(400).json({ error: 'Invalid league' });
      }
      resolvedLeagueId = existingLeague.id;
    } else {
      resolvedLeagueId = defaultLeague?.id;
    }

    if (!resolvedLeagueId) {
      return res.status(500).json({ error: 'No league available for registration' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await runAsync(
      'INSERT INTO users (username, password, is_admin, league_id) VALUES (?, ?, 0, ?)',
      [username, hashedPassword, resolvedLeagueId]
    );
    await runAsync('INSERT INTO user_leagues (user_id, league_id) VALUES (?, ?)', [
      result.lastID,
      resolvedLeagueId,
    ]);

    // Link to player if playerId provided
    if (playerId) {
      await runAsync(
        `UPDATE players
         SET user_id = ?
         WHERE id = ?
           AND id IN (SELECT player_id FROM player_leagues WHERE league_id = ?)`,
        [result.lastID, playerId, resolvedLeagueId]
      );
    }

    const token = signToken(result.lastID, false, resolvedLeagueId);

    res.status(201).json({
      token,
      user: {
        id: result.lastID,
        username,
        isAdmin: false,
        leagueId: resolvedLeagueId,
        leagues: [{ id: resolvedLeagueId, name: (await getAsync('SELECT name FROM leagues WHERE id = ?', [resolvedLeagueId]))?.name || 'League' }],
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Switch active league
router.post('/switch-league', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { leagueId } = req.body as { leagueId?: number };
    if (!leagueId) {
      return res.status(400).json({ error: 'leagueId is required' });
    }

    const user = await getAsync('SELECT id, username, is_admin FROM users WHERE id = ?', [req.userId]) as {
      id: number;
      username: string;
      is_admin: number;
    } | undefined;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isAdmin = user.is_admin === 1;
    const leagues = await getAccessibleLeagues(user.id, isAdmin);
    const hasAccess = leagues.some((league) => league.id === Number(leagueId));

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied for selected league' });
    }

    await runAsync('UPDATE users SET league_id = ? WHERE id = ?', [leagueId, user.id]);
    const token = signToken(user.id, isAdmin, Number(leagueId));

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        isAdmin,
        leagueId: Number(leagueId),
        leagues,
      },
    });
  } catch (error) {
    console.error('Switch league error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
