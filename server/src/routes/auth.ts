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
      { userId: user.id, isAdmin: user.is_admin === 1 },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin === 1,
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
    const { username, password, playerId } = req.body;

    // Check if username exists
    const existing = await getAsync('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await runAsync(
      'INSERT INTO users (username, password, is_admin) VALUES (?, ?, 0)',
      [username, hashedPassword]
    );

    // Link to player if playerId provided
    if (playerId) {
      await runAsync('UPDATE players SET user_id = ? WHERE id = ?', [result.lastID, playerId]);
    }

    const token = jwt.sign(
      { userId: result.lastID, isAdmin: false },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: result.lastID,
        username,
        isAdmin: false,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
