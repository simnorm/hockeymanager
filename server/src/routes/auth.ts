import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getAsync, runAsync } from '../database.js';
import { User } from '../types.js';

const router = express.Router();

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

    const token = jwt.sign(
      { userId: user.id, isAdmin: user.is_admin === 1, leagueId: user.league_id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin === 1,
        leagueId: user.league_id,
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
        'SELECT id, league_id, user_id FROM players WHERE id = ? AND is_active = 1',
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

    // Link to player if playerId provided
    if (playerId) {
      await runAsync('UPDATE players SET user_id = ? WHERE id = ? AND league_id = ?', [
        result.lastID,
        playerId,
        resolvedLeagueId,
      ]);
    }

    const token = jwt.sign(
      { userId: result.lastID, isAdmin: false, leagueId: resolvedLeagueId },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: result.lastID,
        username,
        isAdmin: false,
        leagueId: resolvedLeagueId,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
