import express, { Request, Response } from 'express';
import { getAsync, runAsync } from '../database.js';
import { Attendance } from '../types.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Update attendance status
router.put('/:gameId/:playerId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { gameId, playerId } = req.params;
    const { status } = req.body;

    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "present" or "absent"' });
    }

    // Check if attendance record exists
    const existing = await getAsync(
      'SELECT * FROM attendance WHERE game_id = ? AND player_id = ?',
      [gameId, playerId]
    ) as Attendance;

    if (!existing) {
      // Create attendance record if it doesn't exist
      await runAsync(
        'INSERT INTO attendance (game_id, player_id, status, responded_at) VALUES (?, ?, ?, datetime("now"))',
        [gameId, playerId, status]
      );
    } else {
      // Update existing record
      await runAsync(
        'UPDATE attendance SET status = ?, responded_at = datetime("now") WHERE game_id = ? AND player_id = ?',
        [status, gameId, playerId]
      );
    }

    const attendance = await getAsync(
      'SELECT * FROM attendance WHERE game_id = ? AND player_id = ?',
      [gameId, playerId]
    ) as Attendance;

    res.json(attendance);
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
